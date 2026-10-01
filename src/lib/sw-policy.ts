/**
 * Service worker route policy. The worker in src/pwa/sw.ts bundles this module.
 * Navigations are network-only: nothing here stores an HTML document for replay.
 */

export const SW_VERSION = "v2";
export const CACHE_PREFIX = `rangach-pwa-${SW_VERSION}`;
export const STATIC_CACHE = `${CACHE_PREFIX}-static`;
export const IMAGE_CACHE = `${CACHE_PREFIX}-images`;
export const OFFLINE_CACHE = `${CACHE_PREFIX}-offline`;
export const ACTIVE_CACHES = [STATIC_CACHE, IMAGE_CACHE, OFFLINE_CACHE] as const;
export const MAX_CACHED_IMAGES = 32;
export const OFFLINE_PATH = "/offline";

/**
 * Never intercept these. Covers admin, account, auth (login, register, /api/auth,
 * and a custom /auth base), payment APIs, and the upgrade / checkout flow.
 * Matching is on the decoded path prefix, not a substring, so /listings/admin is public.
 */
export const NEVER_STORE_PREFIXES = [
  "/admin",
  "/account",
  "/api",
  "/login",
  "/register",
  "/upgrade",
  "/checkout",
  "/auth",
] as const;

export type RequestPlan =
  | { kind: "bypass"; reason: "non-get" | "range" | "action" | "sensitive" | "pricing" | "cross-origin" | "default" }
  | { kind: "navigate" }
  | { kind: "cache-first"; cache: "static" | "image" };

export type RequestPlanInput = {
  method: string;
  pathname: string;
  destination: string;
  mode: string;
  sameOrigin: boolean;
  hostname?: string;
  hasRange?: boolean;
  serverAction?: boolean;
};

export function normalizePathname(pathname: string): string {
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

export function isNeverStorePath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return NEVER_STORE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isPricingPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/pricing" || path.startsWith("/pricing/");
}

/**
 * Mux HLS and thumbnails must not be stored. Segments are large, signed URLs expire,
 * and a cached stream would keep playing after a video is rejected or a plan lapses.
 */
export function isMuxMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "stream.mux.com" || host === "image.mux.com" || host.endsWith(".mux.com");
}

export function isBlobImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "blob.vercel-storage.com" || host.endsWith(".blob.vercel-storage.com");
}

export function isStaticAssetPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path.startsWith("/_next/static/")) return true;
  if (path.startsWith("/icons/")) return true;
  if (path === "/favicon.ico" || path === "/logo.svg" || path === "/hero-community.svg") return true;
  if (path === "/icon" || path.startsWith("/icon.") || path === "/apple-icon" || path.startsWith("/apple-icon.")) return true;
  return false;
}

export function isCacheableImagePath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (isNeverStorePath(path) || isPricingPath(path)) return false;
  if (path.startsWith("/_next/image")) return true;
  if (path.startsWith("/icons/")) return true;
  if (path === "/hero-community.svg" || path === "/logo.svg" || path === "/favicon.ico") return true;
  return /\.(png|jpe?g|webp|gif|svg|ico|avif)$/.test(path);
}

export function planRequest(input: RequestPlanInput): RequestPlan {
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
    if (input.hostname && isMuxMediaHost(input.hostname)) return { kind: "bypass", reason: "cross-origin" };
    if (method === "GET" && input.destination === "image" && input.hostname && isBlobImageHost(input.hostname)) {
      return { kind: "cache-first", cache: "image" };
    }
    return { kind: "bypass", reason: "cross-origin" };
  }

  if (method !== "GET") return { kind: "bypass", reason: "default" };

  if (isStaticAssetPath(path)) return { kind: "cache-first", cache: "static" };
  if (path.startsWith("/_next/image") || (input.destination === "image" && isCacheableImagePath(path))) {
    return { kind: "cache-first", cache: "image" };
  }
  if (input.destination === "font" && path.startsWith("/_next/static/")) {
    return { kind: "cache-first", cache: "static" };
  }
  return { kind: "bypass", reason: "default" };
}

/** True only for hashed static files, icons, fonts, and the bounded image cache. */
export function mayStoreResponse(plan: RequestPlan): boolean {
  return plan.kind === "cache-first";
}

/**
 * HTML navigations are never replayed from cache. The only stored document is the
 * offline fallback, and only under OFFLINE_PATH — never under /pricing or any other URL.
 */
export function servesStoredDocument(plan: RequestPlan): boolean {
  switch (plan.kind) {
    case "bypass":
    case "navigate":
    case "cache-first":
      return false;
    default: {
      const unreachable: never = plan;
      return unreachable;
    }
  }
}

/** A successful visit to /offline may refresh the fallback entry. Every other URL returns null. */
export function navigationCacheKey(pathname: string): string | null {
  return normalizePathname(pathname) === OFFLINE_PATH ? OFFLINE_PATH : null;
}

export function mayStoreAssetResponse(input: {
  ok: boolean;
  redirected: boolean;
  type: string;
  contentType: string | null;
  cache: "static" | "image";
}): boolean {
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

export function cachesToDelete(existing: readonly string[], kill: boolean): string[] {
  if (kill) return [...existing];
  const active = new Set<string>(ACTIVE_CACHES);
  return existing.filter((name) => name.startsWith("rangach-pwa-") && !active.has(name));
}

export function imageKeysToEvict(keys: readonly string[], max = MAX_CACHED_IMAGES): string[] {
  if (keys.length <= max) return [];
  return keys.slice(0, keys.length - max);
}

/** Last-resort document when /offline itself could not be cached. No prices, no account data. */
export const OFFLINE_SHELL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1a2436">
<title>Offline · Rangach</title>
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
