import sharp from "sharp";
import { MAX_IMAGE_BYTES } from "@/lib/image-file";
import { isBlobImageHost } from "@/lib/sw-policy";

export const LISTING_PHOTO_MAX_PX = 768;

export function isAllowedListingPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    return isBlobImageHost(url.hostname);
  } catch {
    return false;
  }
}

export async function downloadListingPhoto(url: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  if (!isAllowedListingPhotoUrl(url)) throw new Error("photo-host");
  const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
  if (response.status >= 300 && response.status < 400) throw new Error("photo-redirect");
  if (!response.ok) throw new Error("photo-fetch");
  const advertised = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(advertised) && advertised > MAX_IMAGE_BYTES) throw new Error("photo-size");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("photo-size");
  return bytes;
}

/** JPEG whose longest side is at most 768 pixels. Does not touch the seller's stored file. */
export async function resizeListingPhoto(bytes: Uint8Array): Promise<Uint8Array> {
  const out = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: LISTING_PHOTO_MAX_PX,
      height: LISTING_PHOTO_MAX_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(out);
}
