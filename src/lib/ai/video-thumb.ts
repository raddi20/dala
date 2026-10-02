import { MAX_IMAGE_BYTES } from "@/lib/image-file";

/** Mux public playback ids are URL-safe tokens. Anything else is rejected. */
const PLAYBACK_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type PublicVideoThumbInput = {
  id: string;
  status: string;
  publicPlaybackId: string;
  published: boolean;
  verifiedPro: boolean;
  ownerUser: string;
};

export type PublicVideoThumbTarget = {
  ownerType: "video";
  ownerId: string;
  url: string;
  ownerUser: string;
};

/**
 * Default public Mux thumbnail, with no crop, time, or token query.
 * Pending and signed playback ids are not accepted here.
 */
export function publicMuxThumbnailUrl(publicPlaybackId: string): string | null {
  const id = publicPlaybackId.trim();
  if (!PLAYBACK_ID.test(id)) return null;
  return `https://image.mux.com/${id}/thumbnail.jpg`;
}

export function isPublicMuxThumbnailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password || url.port) return false;
    if (url.hostname !== "image.mux.com") return false;
    if (url.search || url.hash) return false;
    const parts = url.pathname.split("/");
    if (parts.length !== 3 || parts[0] !== "" || parts[2] !== "thumbnail.jpg") return false;
    const id = parts[1] ?? "";
    return publicMuxThumbnailUrl(id) === value;
  } catch {
    return false;
  }
}

/**
 * Approved public shop videos only. A lapsed Pro plan, an unpublished shop,
 * or a still-private playback id is left for a later run.
 */
export function publicVideoThumbTargets(rows: PublicVideoThumbInput[]): PublicVideoThumbTarget[] {
  const out: PublicVideoThumbTarget[] = [];
  for (const row of rows) {
    if (!row.verifiedPro || !row.published || row.status !== "approved") continue;
    if (!row.ownerUser.trim()) continue;
    const url = publicMuxThumbnailUrl(row.publicPlaybackId);
    if (!url) continue;
    out.push({ ownerType: "video", ownerId: row.id, url, ownerUser: row.ownerUser });
  }
  return out;
}

export async function downloadPublicMuxThumbnail(url: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  if (!isPublicMuxThumbnailUrl(url)) throw new Error("thumb-host");
  const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
  if (response.status >= 300 && response.status < 400) throw new Error("thumb-redirect");
  if (!response.ok) throw new Error("thumb-fetch");
  const advertised = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(advertised) && advertised > MAX_IMAGE_BYTES) throw new Error("thumb-size");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("thumb-size");
  return bytes;
}
