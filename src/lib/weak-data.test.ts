import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cardPhoto } from "@/lib/image-variants";
import { hasSessionCookie } from "@/proxy";
import {
  ACTIVE_CACHES,
  MAX_CACHED_PAGES,
  PAGE_CACHE,
  PRIVATE_HEADER,
  cachesToDelete,
  mayKeepPage,
  pageCacheKey,
  pageKeysToEvict,
} from "@/lib/sw-policy";
import { liteFrom } from "@/lib/weak-data";

test("public pages already viewed may be kept offline; private, form and paid pages never", () => {
  for (const path of ["/", "/listings", "/listings/cmabc123", "/b/fresh-tilapia", "/shops", "/occasions/ayie", "/saved", "/faq"]) {
    assert.ok(pageCacheKey(path), path);
  }
  for (const path of [
    "/admin",
    "/account",
    "/account/storefront",
    "/login",
    "/register",
    "/api/saved",
    "/pricing",
    "/upgrade",
    "/listings/new",
    "/listings/abc/edit",
    "/b/shop/sticker",
    "/orders/1",
    "/send-home",
    "/offline",
    "/%61dmin",
    "/Account/",
  ]) {
    assert.equal(pageCacheKey(path), null, path);
  }
});

test("the page key keeps search filters and drops tracking junk", () => {
  assert.equal(pageCacheKey("/listings", "?utm_source=x&q=fundi&city=kisumu"), "/listings?city=kisumu&q=fundi");
  assert.equal(pageCacheKey("/b/fundi", "?ref=sticker"), "/b/fundi");
});

test("only a plain 200 HTML page for a signed-out visitor is kept", () => {
  const good = { ok: true, status: 200, redirected: false, type: "basic", contentType: "text/html; charset=utf-8", privateHeader: null, cacheControl: "private, no-cache" };
  assert.equal(mayKeepPage(good), true);
  assert.equal(mayKeepPage({ ...good, privateHeader: "1" }), false);
  assert.equal(mayKeepPage({ ...good, status: 404, ok: false }), false);
  assert.equal(mayKeepPage({ ...good, redirected: true }), false);
  assert.equal(mayKeepPage({ ...good, contentType: "text/x-component" }), false);
  assert.equal(mayKeepPage({ ...good, cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate" }), true);
  assert.equal(mayKeepPage({ ...good, type: "opaque" }), false);
});

test("the page cache is bounded and versioned with the others", () => {
  assert.ok(ACTIVE_CACHES.includes(PAGE_CACHE as (typeof ACTIVE_CACHES)[number]));
  assert.deepEqual(cachesToDelete([...ACTIVE_CACHES], false), []);
  const keys = Array.from({ length: MAX_CACHED_PAGES + 3 }, (_, i) => `/listings/l${i}`);
  assert.deepEqual(pageKeysToEvict(keys), ["/listings/l0", "/listings/l1", "/listings/l2"]);
});

test("the proxy marks signed-in requests so their pages are never kept", () => {
  assert.equal(PRIVATE_HEADER, "x-rangach-private");
  assert.equal(hasSessionCookie(["authjs.session-token"]), true);
  assert.equal(hasSessionCookie(["__Secure-authjs.session-token.0"]), true);
  assert.equal(hasSessionCookie(["rangach_lang", "rangach_visitor"]), false);
  const worker = readFileSync(new URL("../pwa/sw.ts", import.meta.url), "utf8");
  assert.match(worker, /caches\.delete\(PAGE_CACHE\)/);
  assert.match(worker, /SLOW_NETWORK_MS/);
  const built = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  assert.match(built, /rangach-pwa-\$\{SW_VERSION\}|pages/);
  assert.match(built, /x-rangach-private/);
});

test("lite mode follows Save-Data, the visitor's switch, and 2G", () => {
  assert.equal(liteFrom({ saveData: "on" }), true);
  assert.equal(liteFrom({ saveData: "on", cookie: "0" }), false);
  assert.equal(liteFrom({ cookie: "1" }), true);
  assert.equal(liteFrom({ ect: "2g" }), true);
  assert.equal(liteFrom({ ect: "4g" }), false);
  assert.equal(liteFrom({}), false);
});

test("lite photos use the 480px copy only and stay lazy", () => {
  const full = cardPhoto({ src: "https://b/x.jpg", thumb480: "https://b/x.w480.webp", thumb960: "https://b/x.w960.webp", width: 480, height: 360 });
  assert.match(full?.srcSet ?? "", /960w/);
  const lite = cardPhoto({ src: "https://b/x.jpg", thumb480: "https://b/x.w480.webp", thumb960: "https://b/x.w960.webp", width: 480, height: 360, lite: true });
  assert.equal(lite?.srcSet, "https://b/x.w480.webp 480w");
  assert.equal(lite?.loading, "lazy");
  const unsplash = cardPhoto({ src: "https://images.unsplash.com/photo-1", width: 480, height: 360, lite: true });
  assert.match(unsplash?.src ?? "", /w=360/);
  assert.match(unsplash?.src ?? "", /q=45/);
  assert.doesNotMatch(unsplash?.srcSet ?? "", /960/);
});

test("offline notice and kept-page list are wired in", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<OfflineNotice \/>/);
  const offline = readFileSync(new URL("../app/offline/page.tsx", import.meta.url), "utf8");
  assert.match(offline, /<OfflinePages \/>/);
  const notice = readFileSync(new URL("../components/offline-notice.tsx", import.meta.url), "utf8");
  assert.match(notice, /You&apos;re offline\. Pages you&apos;ve already opened still work/);
});

test("an unvisited page offline moves to /offline with a safe way back", async () => {
  const { offlineRedirectPath, safeNext } = await import("@/lib/sw-policy");
  assert.equal(offlineRedirectPath("/categories?x=1"), "/offline?next=%2Fcategories%3Fx%3D1");
  assert.equal(safeNext("https://evil.example"), "/");
  assert.equal(safeNext("//evil.example"), "/");
  assert.equal(safeNext("/offline?next=/x"), "/");
  assert.equal(safeNext("/b/fundi"), "/b/fundi");
});

test("the offline page's own scripts and styles are found for precaching", async () => {
  const { offlineAssetPaths } = await import("@/lib/sw-policy");
  const html = '<link rel="stylesheet" href="/_next/static/chunks/a.css"><script src="/_next/static/chunks/b.js" async></script><script src="https://evil/x.js"></script><script src="/_next/static/chunks/b.js"></script>';
  assert.deepEqual(offlineAssetPaths(html), ["/_next/static/chunks/a.css", "/_next/static/chunks/b.js"]);
});
