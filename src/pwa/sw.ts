/**
 * Rangach service worker.
 *
 * Kill switch: set SW_MODE to "kill", then deploy. `npm run build` and
 * `npm run build:vercel` regenerate public/sw.js from this file. The replacement
 * worker deletes every Cache Storage entry, unregisters itself, and reloads open tabs.
 * Browsers pick it up because /sw.js is served with Cache-Control: no-store and the
 * page registers the worker with updateViaCache: "none".
 *
 * Leave SW_MODE as "kill" until you want a worker again, then set it back to "on"
 * and deploy once more. Do not cache /sw.js from this worker.
 *
 * Caching rules live in src/lib/sw-policy.ts. HTML navigations are network-first.
 * Weak-data mode: a public page the visitor already opened while signed out is kept
 * (at most MAX_CACHED_PAGES) and shown when the network is gone or very slow.
 * Admin, account, auth, pricing, forms and any page for a signed-in visitor are never kept.
 * Mux playback (stream.mux.com) and posters (image.mux.com) are never cached.
 */

import {
  IMAGE_CACHE,
  OFFLINE_CACHE,
  OFFLINE_PATH,
  OFFLINE_SHELL_HTML,
  PAGE_CACHE,
  PRIVATE_HEADER,
  SLOW_NETWORK_MS,
  STATIC_CACHE,
  cachesToDelete,
  imageKeysToEvict,
  mayKeepPage,
  mayStoreAssetResponse,
  navigationCacheKey,
  normalizePathname,
  offlineAssetPaths,
  offlineRedirectPath,
  pageCacheKey,
  pageKeysToEvict,
  planRequest,
} from "../lib/sw-policy";

const SW_MODE: "on" | "kill" = "on";

const worker = self as unknown as ServiceWorkerGlobalScope;

const PRECACHE_ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/icon-maskable-192.png"];

worker.addEventListener("install", (event) => {
  worker.skipWaiting();
  if (SW_MODE === "kill") return;
  event.waitUntil(precache().catch(() => undefined));
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(SW_MODE === "kill" ? killWorker() : claimWorker());
});

worker.addEventListener("message", (event) => {
  if (event.data && (event.data as { type?: string }).type === "SKIP_WAITING") {
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
    serverAction: request.headers.has("next-action"),
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
      credentials: "omit",
    });
    if (response.ok && response.type === "basic" && !response.redirected) {
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("text/html")) {
        const html = await response.clone().text();
        await offlineCache.put(OFFLINE_PATH, response);
        // The offline page must hydrate without signal, so its own scripts and styles are stored too.
        await precacheAssets(offlineAssetPaths(html));
      }
    }
  } catch {
    // The inline shell covers a failed precache.
  }

  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.all(
    PRECACHE_ICONS.map(async (path) => {
      try {
        const response = await fetch(path);
        if (response.ok && !response.redirected) await staticCache.put(path, response);
      } catch {
        // Icons are also cache-first on the next request.
      }
    }),
  );
}

async function precacheAssets(paths: string[]) {
  const staticCache = await caches.open(STATIC_CACHE);
  await Promise.all(
    paths.map(async (path) => {
      try {
        if (await staticCache.match(path)) return;
        const response = await fetch(path);
        if (response.ok && !response.redirected) await staticCache.put(path, response);
      } catch {
        // Fetched again cache-first on the next visit.
      }
    }),
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

async function fetchNavigation(request: Request): Promise<Response> {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch (error) {
    // A few browsers reject a cache-mode override on a navigation request.
    if (request.mode !== "navigate") throw error;
    return fetch(request);
  }
}

async function keepPage(key: string, response: Response) {
  if (
    !mayKeepPage({
      ok: response.ok,
      status: response.status,
      redirected: response.redirected,
      type: response.type,
      contentType: response.headers.get("content-type"),
      privateHeader: response.headers.get(PRIVATE_HEADER),
      cacheControl: response.headers.get("cache-control"),
    })
  ) {
    return;
  }
  const cache = await caches.open(PAGE_CACHE);
  await cache.delete(key);
  await cache.put(key, response);
  const keys = await cache.keys();
  const extra = pageKeysToEvict(keys.map((entry) => new URL(entry.url).pathname + new URL(entry.url).search));
  await Promise.all(extra.map((entry) => cache.delete(entry)));
}

async function networkNavigation(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pageKey = pageCacheKey(url.pathname, url.search);
  const kept = pageKey ? await (await caches.open(PAGE_CACHE)).match(pageKey) : undefined;

  const network = (async () => {
    const response = await fetchNavigation(request);
    const cacheKey = navigationCacheKey(url.pathname);
    if (cacheKey && response.ok && response.type === "basic" && !response.redirected) {
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("text/html")) {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.put(cacheKey, response.clone());
      }
    }
    if (response.headers.get(PRIVATE_HEADER)) {
      // Signed in: keep nothing, and drop the kept pages so a shared phone shows nothing stale offline.
      await caches.delete(PAGE_CACHE).catch(() => false);
    } else if (pageKey) {
      await keepPage(pageKey, response.clone()).catch(() => undefined);
    }
    return response;
  })();

  if (!kept) {
    try {
      return await network;
    } catch {
      // Move to /offline so the fallback page hydrates on its own route; Try again returns here.
      if (normalizePathname(url.pathname) !== OFFLINE_PATH) {
        return Response.redirect(new URL(offlineRedirectPath(url.pathname + url.search), worker.location.origin).toString(), 302);
      }
      return offlineDocument();
    }
  }

  // Weak signal: show the kept copy if the network is very slow; the fresh copy still lands in the cache.
  let timer = 0;
  const slow = new Promise<Response>((resolve) => {
    timer = setTimeout(() => resolve(kept.clone()), SLOW_NETWORK_MS) as unknown as number;
  });
  try {
    return await Promise.race([network, slow]);
  } catch {
    return kept;
  } finally {
    clearTimeout(timer);
  }
}

async function offlineDocument(): Promise<Response> {
  const cache = await caches.open(OFFLINE_CACHE);
  const cached = await cache.match(OFFLINE_PATH);
  if (cached) return cached;
  return new Response(OFFLINE_SHELL_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function cacheFirst(request: Request, cacheName: "static" | "image"): Promise<Response> {
  const name = cacheName === "static" ? STATIC_CACHE : IMAGE_CACHE;
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (
    mayStoreAssetResponse({
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      contentType: response.headers.get("content-type"),
      cache: cacheName,
    })
  ) {
    const copy = response.clone();
    if (cacheName === "image") await putBoundedImage(cache, request, copy);
    else await cache.put(request, copy);
  }
  return response;
}

async function putBoundedImage(cache: Cache, request: Request, response: Response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  const extra = imageKeysToEvict(keys.map((key) => key.url));
  await Promise.all(extra.map((url) => cache.delete(url)));
}
