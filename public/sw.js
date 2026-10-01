/*
 * Rangach service worker. Generated from src/pwa/sw.ts — edit that file, then
 * run `node scripts/build-sw.mjs` (also runs from npm run build and build:vercel).
 *
 * Kill switch: set SW_MODE to "kill" in src/pwa/sw.ts and deploy.
 * The replacement worker deletes caches, unregisters itself, and reloads open tabs.
 * /sw.js is served with Cache-Control: no-store so the browser cannot keep a bad copy.
 */
"use strict";
(() => {
  // src/lib/sw-policy.ts
  var SW_VERSION = "v1";
  var CACHE_PREFIX = `rangach-pwa-${SW_VERSION}`;
  var STATIC_CACHE = `${CACHE_PREFIX}-static`;
  var IMAGE_CACHE = `${CACHE_PREFIX}-images`;
  var OFFLINE_CACHE = `${CACHE_PREFIX}-offline`;
  var ACTIVE_CACHES = [STATIC_CACHE, IMAGE_CACHE, OFFLINE_CACHE];
  var MAX_CACHED_IMAGES = 32;
  var OFFLINE_PATH = "/offline";
  var NEVER_STORE_PREFIXES = [
    "/admin",
    "/account",
    "/api",
    "/login",
    "/register",
    "/upgrade",
    "/checkout",
    "/auth"
  ];
  function normalizePathname(pathname) {
    let path = pathname || "/";
    const hash = path.indexOf("#");
    if (hash >= 0) path = path.slice(0, hash);
    const query = path.indexOf("?");
    if (query >= 0) path = path.slice(0, query);
    for (let i = 0; i < 3; i += 1) {
      try {
        const decoded = decodeURIComponent(path);
        if (decoded === path) break;
        path = decoded;
      } catch {
        break;
      }
    }
    if (!path.startsWith("/")) path = `/${path}`;
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path.toLowerCase();
  }
  function isNeverStorePath(pathname) {
    const path = normalizePathname(pathname);
    return NEVER_STORE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }
  function isPricingPath(pathname) {
    const path = normalizePathname(pathname);
    return path === "/pricing" || path.startsWith("/pricing/");
  }
  function isBlobImageHost(hostname) {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    return host === "blob.vercel-storage.com" || host.endsWith(".blob.vercel-storage.com");
  }
  function isStaticAssetPath(pathname) {
    const path = normalizePathname(pathname);
    if (path.startsWith("/_next/static/")) return true;
    if (path.startsWith("/icons/")) return true;
    if (path === "/favicon.ico" || path === "/logo.svg" || path === "/hero-community.svg") return true;
    if (path === "/icon" || path.startsWith("/icon.") || path === "/apple-icon" || path.startsWith("/apple-icon.")) return true;
    return false;
  }
  function isCacheableImagePath(pathname) {
    const path = normalizePathname(pathname);
    if (isNeverStorePath(path) || isPricingPath(path)) return false;
    if (path.startsWith("/_next/image")) return true;
    if (path.startsWith("/icons/")) return true;
    if (path === "/hero-community.svg" || path === "/logo.svg" || path === "/favicon.ico") return true;
    return /\.(png|jpe?g|webp|gif|svg|ico|avif)$/.test(path);
  }
  function planRequest(input) {
    const method = input.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") return { kind: "bypass", reason: "non-get" };
    if (input.hasRange) return { kind: "bypass", reason: "range" };
    if (input.serverAction) return { kind: "bypass", reason: "action" };
    const path = normalizePathname(input.pathname);
    if (isNeverStorePath(path)) return { kind: "bypass", reason: "sensitive" };
    const navigation = input.mode === "navigate" || input.destination === "document";
    if (navigation) return { kind: "navigate" };
    if (isPricingPath(path)) return { kind: "bypass", reason: "pricing" };
    if (!input.sameOrigin) {
      if (method === "GET" && input.destination === "image" && input.hostname && isBlobImageHost(input.hostname)) {
        return { kind: "cache-first", cache: "image" };
      }
      return { kind: "bypass", reason: "cross-origin" };
    }
    if (method !== "GET") return { kind: "bypass", reason: "default" };
    if (isStaticAssetPath(path)) return { kind: "cache-first", cache: "static" };
    if (path.startsWith("/_next/image") || input.destination === "image" && isCacheableImagePath(path)) {
      return { kind: "cache-first", cache: "image" };
    }
    if (input.destination === "font" && path.startsWith("/_next/static/")) {
      return { kind: "cache-first", cache: "static" };
    }
    return { kind: "bypass", reason: "default" };
  }
  function navigationCacheKey(pathname) {
    return normalizePathname(pathname) === OFFLINE_PATH ? OFFLINE_PATH : null;
  }
  function mayStoreAssetResponse(input) {
    if (input.redirected) return false;
    if (input.type === "opaque") return input.cache === "image";
    if (!input.ok) return false;
    if (input.type !== "basic" && input.type !== "cors") return false;
    const contentType = (input.contentType ?? "").toLowerCase();
    if (contentType.includes("text/html") || contentType.includes("text/x-component")) return false;
    if (input.cache === "image") {
      return contentType.startsWith("image/") || contentType.includes("svg");
    }
    return true;
  }
  function cachesToDelete(existing, kill) {
    if (kill) return [...existing];
    const active = new Set(ACTIVE_CACHES);
    return existing.filter((name) => name.startsWith("rangach-pwa-") && !active.has(name));
  }
  function imageKeysToEvict(keys, max = MAX_CACHED_IMAGES) {
    if (keys.length <= max) return [];
    return keys.slice(0, keys.length - max);
  }
  var OFFLINE_SHELL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1a2436">
<title>Offline \xB7 Rangach</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f7f3ec;color:#141a24;font-family:Georgia,"Iowan Old Style",serif;padding:24px}
  main{max-width:28rem;text-align:center}
  h1{font-size:1.8rem;font-weight:600;color:#1a2436;margin:16px 0 8px}
  p{font-family:"Segoe UI",sans-serif;font-size:.95rem;line-height:1.5;color:#5c6573;margin:0}
  button{margin-top:20px;background:#1a2436;color:#fff;border:0;border-radius:12px;padding:10px 16px;font:600 .9rem/1 "Segoe UI",sans-serif;cursor:pointer}
</style>
</head>
<body>
<main>
<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 32 32" aria-hidden="true">
<rect width="32" height="32" rx="8" fill="#1a2436"/>
<path d="M9.5 26V13.2" stroke="#fbf1dc" stroke-width="2" stroke-linecap="round"/>
<path d="M22.5 26V13.2" stroke="#fbf1dc" stroke-width="2" stroke-linecap="round"/>
<path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke="#fbf1dc" stroke-width="2" stroke-linecap="round"/>
<path d="M9.5 16.4h13" stroke="#c8881a" stroke-width="1.8" stroke-linecap="round"/>
</svg>
<h1>You are offline</h1>
<p>The gateway to the Luo home. Reconnect to see the latest listings and prices, then try again.</p>
<button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;

  // src/pwa/sw.ts
  var SW_MODE = "on";
  var worker = self;
  var PRECACHE_ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/icon-maskable-192.png"];
  worker.addEventListener("install", (event) => {
    worker.skipWaiting();
    if (SW_MODE === "kill") return;
    event.waitUntil(precache().catch(() => void 0));
  });
  worker.addEventListener("activate", (event) => {
    event.waitUntil(SW_MODE === "kill" ? killWorker() : claimWorker());
  });
  worker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      worker.skipWaiting();
    }
  });
  worker.addEventListener("fetch", (event) => {
    if (SW_MODE === "kill") return;
    const request = event.request;
    const url = new URL(request.url);
    const plan = planRequest({
      method: request.method,
      pathname: url.pathname,
      destination: request.destination,
      mode: request.mode,
      sameOrigin: url.origin === worker.location.origin,
      hostname: url.hostname,
      hasRange: request.headers.has("range"),
      serverAction: request.headers.has("next-action")
    });
    if (plan.kind === "bypass") return;
    if (plan.kind === "navigate") {
      event.respondWith(networkNavigation(request));
      return;
    }
    event.respondWith(cacheFirst(request, plan.cache));
  });
  async function precache() {
    const offlineCache = await caches.open(OFFLINE_CACHE);
    try {
      const response = await fetch(new URL(OFFLINE_PATH, worker.location.origin).toString(), {
        cache: "reload",
        credentials: "omit"
      });
      if (response.ok && response.type === "basic" && !response.redirected) {
        const type = response.headers.get("content-type") ?? "";
        if (type.includes("text/html")) await offlineCache.put(OFFLINE_PATH, response);
      }
    } catch {
    }
    const staticCache = await caches.open(STATIC_CACHE);
    await Promise.all(
      PRECACHE_ICONS.map(async (path) => {
        try {
          const response = await fetch(path);
          if (response.ok && !response.redirected) await staticCache.put(path, response);
        } catch {
        }
      })
    );
  }
  async function claimWorker() {
    const keys = await caches.keys();
    await Promise.all(cachesToDelete(keys, false).map((key) => caches.delete(key)));
    await worker.clients.claim();
  }
  async function killWorker() {
    const keys = await caches.keys();
    await Promise.all(cachesToDelete(keys, true).map((key) => caches.delete(key)));
    await worker.registration.unregister();
    const windows = await worker.clients.matchAll({ type: "window" });
    await Promise.all(windows.map((client) => client.navigate(client.url)));
  }
  async function fetchNavigation(request) {
    try {
      return await fetch(request, { cache: "no-store" });
    } catch (error) {
      if (request.mode !== "navigate") throw error;
      return fetch(request);
    }
  }
  async function networkNavigation(request) {
    const url = new URL(request.url);
    try {
      const response = await fetchNavigation(request);
      const cacheKey = navigationCacheKey(url.pathname);
      if (cacheKey && response.ok && response.type === "basic" && !response.redirected) {
        const type = response.headers.get("content-type") ?? "";
        if (type.includes("text/html")) {
          const cache = await caches.open(OFFLINE_CACHE);
          await cache.put(cacheKey, response.clone());
        }
      }
      return response;
    } catch {
      return offlineDocument();
    }
  }
  async function offlineDocument() {
    const cache = await caches.open(OFFLINE_CACHE);
    const cached = await cache.match(OFFLINE_PATH);
    if (cached) return cached;
    return new Response(OFFLINE_SHELL_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
  async function cacheFirst(request, cacheName) {
    const name = cacheName === "static" ? STATIC_CACHE : IMAGE_CACHE;
    const cache = await caches.open(name);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (mayStoreAssetResponse({
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      contentType: response.headers.get("content-type"),
      cache: cacheName
    })) {
      const copy = response.clone();
      if (cacheName === "image") await putBoundedImage(cache, request, copy);
      else await cache.put(request, copy);
    }
    return response;
  }
  async function putBoundedImage(cache, request, response) {
    await cache.put(request, response);
    const keys = await cache.keys();
    const extra = imageKeysToEvict(keys.map((key) => key.url));
    await Promise.all(extra.map((url) => cache.delete(url)));
  }
})();
