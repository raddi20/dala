import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTIVE_CACHES,
  OFFLINE_PATH,
  OFFLINE_SHELL_HTML,
  cachesToDelete,
  imageKeysToEvict,
  isMuxMediaHost,
  isNeverStorePath,
  isPricingPath,
  mayStoreAssetResponse,
  mayStoreResponse,
  navigationCacheKey,
  planRequest,
  servesStoredDocument,
  type RequestPlanInput,
} from "@/lib/sw-policy";

function plan(overrides: Partial<RequestPlanInput> & Pick<RequestPlanInput, "pathname">) {
  return planRequest({
    method: "GET",
    destination: "",
    mode: "cors",
    sameOrigin: true,
    ...overrides,
  });
}

const sensitive = [
  "/admin",
  "/admin/reports",
  "/account",
  "/account/storefront",
  "/login",
  "/login?next=/account",
  "/register",
  "/api/auth/session",
  "/api/auth/callback/credentials",
  "/api/payments/flutterwave",
  "/api/uploads",
  "/upgrade",
  "/upgrade/return",
  "/checkout",
  "/auth/signin",
];

test("sensitive, auth, payment, and non-GET requests are never stored", () => {
  for (const pathname of sensitive) {
    assert.equal(isNeverStorePath(pathname), true, pathname);
    const result = plan({ pathname, mode: "navigate", destination: "document" });
    assert.equal(result.kind, "bypass", pathname);
    assert.equal(mayStoreResponse(result), false, pathname);
    assert.equal(navigationCacheKey(pathname), null, pathname);
  }

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const result = plan({ pathname: "/listings", method });
    assert.deepEqual(result, { kind: "bypass", reason: "non-get" });
    assert.equal(mayStoreResponse(result), false);
  }

  const payment = plan({ pathname: "/api/payments/flutterwave", method: "POST" });
  assert.equal(payment.kind, "bypass");
  assert.equal(plan({ pathname: "/listings", serverAction: true, mode: "navigate" }).kind, "bypass");
  assert.equal(plan({ pathname: "/_next/static/chunk.js", hasRange: true }).kind, "bypass");
});

test("encoded and trailing-slash variants of private routes stay excluded", () => {
  assert.equal(isNeverStorePath("/Admin/"), true);
  assert.equal(isNeverStorePath("/account/"), true);
  assert.equal(isNeverStorePath("/%61dmin"), true);
  assert.equal(isNeverStorePath("/login/"), true);
  assert.equal(plan({ pathname: "/listings/admin", mode: "navigate", destination: "document" }).kind, "navigate");
});

test("mux streams and thumbnails are never cached", () => {
  assert.equal(isMuxMediaHost("stream.mux.com"), true);
  assert.equal(isMuxMediaHost("image.mux.com"), true);
  assert.equal(isMuxMediaHost("STREAM.MUX.COM."), true);
  assert.equal(isMuxMediaHost("evil-mux.com"), false);
  for (const hostname of ["stream.mux.com", "image.mux.com", "chunk.mux.com"]) {
    const segment = plan({
      pathname: "/test/high.mp4",
      sameOrigin: false,
      hostname,
      destination: "video",
    });
    assert.deepEqual(segment, { kind: "bypass", reason: "cross-origin" });
    assert.equal(mayStoreResponse(segment), false);
    const poster = plan({
      pathname: "/thumb.jpg",
      sameOrigin: false,
      hostname,
      destination: "image",
    });
    assert.equal(poster.kind, "bypass");
    const ranged = plan({ pathname: "/test.m3u8", sameOrigin: false, hostname, hasRange: true });
    assert.equal(ranged.kind, "bypass");
    assert.equal(mayStoreResponse(ranged), false);
  }
});

test("pricing is never served from cache", () => {
  assert.equal(isPricingPath("/pricing"), true);
  assert.equal(isPricingPath("/pricing/"), true);
  assert.equal(isPricingPath("/pricing?city=Nairobi"), true);
  assert.equal(isPricingPath("/listings"), false);

  const navigation = plan({ pathname: "/pricing", mode: "navigate", destination: "document" });
  assert.equal(navigation.kind, "navigate");
  assert.equal(mayStoreResponse(navigation), false);
  assert.equal(servesStoredDocument(navigation), false);
  assert.equal(navigationCacheKey("/pricing"), null);

  const prefetch = plan({ pathname: "/pricing", destination: "" });
  assert.deepEqual(prefetch, { kind: "bypass", reason: "pricing" });
  assert.equal(mayStoreResponse(prefetch), false);
});

test("HTML navigations are network-only and only /offline may refresh the fallback", () => {
  for (const pathname of ["/", "/listings", "/categories", "/occasions", "/b/mama", "/offline"]) {
    const result = plan({ pathname, mode: "navigate", destination: "document" });
    assert.equal(result.kind, "navigate", pathname);
    assert.equal(mayStoreResponse(result), false, pathname);
    assert.equal(servesStoredDocument(result), false, pathname);
  }
  assert.equal(navigationCacheKey("/"), null);
  assert.equal(navigationCacheKey("/listings/abc"), null);
  assert.equal(navigationCacheKey(OFFLINE_PATH), OFFLINE_PATH);
  assert.equal(navigationCacheKey("/offline/"), OFFLINE_PATH);
});

test("hashed static files, icons, and fonts can be cached; other fetches cannot", () => {
  assert.deepEqual(plan({ pathname: "/_next/static/chunks/app.js", destination: "script" }), {
    kind: "cache-first",
    cache: "static",
  });
  assert.deepEqual(plan({ pathname: "/_next/static/media/fraunces.woff2", destination: "font" }), {
    kind: "cache-first",
    cache: "static",
  });
  assert.deepEqual(plan({ pathname: "/icons/icon-192.png", destination: "image" }), {
    kind: "cache-first",
    cache: "static",
  });
  assert.equal(plan({ pathname: "/listings", destination: "" }).kind, "bypass");
  assert.equal(plan({ pathname: "/sw.js", destination: "script" }).kind, "bypass");
  assert.equal(
    plan({
      pathname: "/photo.png",
      destination: "image",
      sameOrigin: false,
      hostname: "images.example.com",
    }).kind,
    "bypass",
  );
  assert.deepEqual(
    plan({
      pathname: "/users/abc/listing/photo.jpg",
      destination: "image",
      sameOrigin: false,
      hostname: "store.public.blob.vercel-storage.com",
    }),
    { kind: "cache-first", cache: "image" },
  );
});

test("asset responses that are HTML, redirects, or errors are not stored", () => {
  assert.equal(
    mayStoreAssetResponse({ ok: true, redirected: false, type: "basic", contentType: "text/html", cache: "static" }),
    false,
  );
  assert.equal(
    mayStoreAssetResponse({
      ok: true,
      redirected: false,
      type: "basic",
      contentType: "text/x-component",
      cache: "static",
    }),
    false,
  );
  assert.equal(
    mayStoreAssetResponse({ ok: true, redirected: true, type: "basic", contentType: "image/png", cache: "static" }),
    false,
  );
  assert.equal(
    mayStoreAssetResponse({
      ok: true,
      redirected: false,
      type: "basic",
      contentType: "application/javascript",
      cache: "static",
    }),
    true,
  );
  assert.equal(
    mayStoreAssetResponse({ ok: false, redirected: false, type: "opaque", contentType: null, cache: "image" }),
    true,
  );
  assert.equal(
    mayStoreAssetResponse({ ok: false, redirected: false, type: "opaque", contentType: null, cache: "static" }),
    false,
  );
});

test("old versioned caches are deleted and the image cache stays bounded", () => {
  assert.deepEqual(cachesToDelete([...ACTIVE_CACHES, "rangach-pwa-v0-static", "other"], false), ["rangach-pwa-v0-static"]);
  assert.deepEqual(cachesToDelete(["rangach-pwa-v1-static", "next-data"], true), ["rangach-pwa-v1-static", "next-data"]);
  const urls = Array.from({ length: 34 }, (_, index) => `https://rangach.test/${index}`);
  assert.deepEqual(imageKeysToEvict(urls, 32), urls.slice(0, 2));
  assert.deepEqual(imageKeysToEvict(urls.slice(0, 32), 32), []);
});

test("offline shell is branded and does not include prices", () => {
  assert.match(OFFLINE_SHELL_HTML, /You are offline/);
  assert.match(OFFLINE_SHELL_HTML, /The gateway to the Luo home/);
  assert.match(OFFLINE_SHELL_HTML, /Try again/);
  assert.equal(OFFLINE_SHELL_HTML.includes("KES"), false);
  assert.equal(OFFLINE_SHELL_HTML.includes("/pricing"), false);
});

test("the built worker keeps the kill switch note and does not cache pages by URL", () => {
  const source = readFileSync(new URL("../pwa/sw.ts", import.meta.url), "utf8");
  const built = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /SW_MODE: "on" \| "kill" = "on"/);
  assert.match(source, /Kill switch/);
  assert.match(source, /unregister/);
  assert.match(built, /Kill switch/);
  assert.match(built, /SW_VERSION = "v2"/);
  assert.match(built, /stream\.mux\.com/);
  assert.match(built, /rangach-pwa-/);
  assert.match(built, /skipWaiting/);
  assert.match(built, /\/admin/);
  assert.match(built, /\/pricing/);
  assert.match(built, /\/api/);
  assert.match(built, /navigationCacheKey/);
});
