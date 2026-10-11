/**
 * Hosts the server may fetch when drawing a share image, and the only hosts
 * next/image may optimize. Hostnames are exact: no `*.` patterns.
 *
 * The Blob host is the live Rangach store (`yypodf6rvjgwdxyk`). Mux thumbnails
 * are the shop-video posters (`image.mux.com`). Anything else falls back to a
 * text card and is never requested.
 */

export const RANGACH_BLOB_HOST = "yypodf6rvjgwdxyk.public.blob.vercel-storage.com";

export const MUX_THUMBNAIL_HOST = "image.mux.com";

export const ALLOWED_REMOTE_IMAGE_HOSTS = [RANGACH_BLOB_HOST, MUX_THUMBNAIL_HOST] as const;

export type RemoteImagePattern = {
  protocol: "https";
  hostname: (typeof ALLOWED_REMOTE_IMAGE_HOSTS)[number];
};

function bareHost(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
}

export function isAllowedRemoteImageHost(hostname: string) {
  const host = bareHost(hostname);
  return (ALLOWED_REMOTE_IMAGE_HOSTS as readonly string[]).includes(host);
}

/** Https URL on an allowlisted host, with no credentials and no odd port. */
export function isAllowedRemoteImageUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  return isAllowedRemoteImageHost(url.hostname);
}

/**
 * Photo the OG renderer may use. A disallowed URL becomes "" so the card is
 * drawn without a picture instead of fetching it.
 * Local `/mock/` files are read from disk (seed and Mux mock), never fetched.
 */
export function ogPhotoSource(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return "";
  if (trimmed.startsWith("/")) {
    if (!trimmed.startsWith("/mock/")) return "";
    if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("\0")) return "";
    return trimmed;
  }
  return isAllowedRemoteImageUrl(trimmed) ? trimmed : "";
}

export function remoteImagePatterns(): RemoteImagePattern[] {
  return ALLOWED_REMOTE_IMAGE_HOSTS.map((hostname) => ({
    protocol: "https",
    hostname,
  }));
}
