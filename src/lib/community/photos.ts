import { isAllowedListingPhotoUrl } from "@/lib/ai/resize-photo";
import { prisma } from "@/lib/prisma";

/** Deletes a Blob photo and its stored thumbs. Leaves Unsplash and other hosts alone. */
export async function deleteUpdatePhoto(url: string): Promise<void> {
  const source = url.trim();
  if (!source || !isAllowedListingPhotoUrl(source)) return;
  const variant = await prisma.imageVariant.findUnique({ where: { sourceUrl: source } }).catch(() => null);
  const urls = [source, variant?.thumb480, variant?.thumb960].filter((item): item is string => Boolean(item));
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    if (variant) await prisma.imageVariant.delete({ where: { sourceUrl: source } }).catch(() => undefined);
    return;
  }
  try {
    const { del } = await import("@vercel/blob");
    await del(urls);
  } catch {
    console.error("Could not delete a shop update photo");
  }
  if (variant) await prisma.imageVariant.delete({ where: { sourceUrl: source } }).catch(() => undefined);
}
