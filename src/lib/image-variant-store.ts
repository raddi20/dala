import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { encodeVariants } from "@/lib/image-thumbs";
import { isVariantComplete, type VariantRecord } from "@/lib/image-variants";

const YEAR = 60 * 60 * 24 * 365;

export async function variantMap(urls: string[]): Promise<Map<string, VariantRecord>> {
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  const map = new Map<string, VariantRecord>();
  if (unique.length === 0) return map;
  const rows = await prisma.imageVariant.findMany({
    where: { sourceUrl: { in: unique } },
    select: { sourceUrl: true, thumb480: true, thumb960: true, longest: true },
  });
  for (const row of rows) {
    map.set(row.sourceUrl, { thumb480: row.thumb480, thumb960: row.thumb960, longest: row.longest });
  }
  return map;
}

/**
 * Store 480 and 960 WebP files next to an original that is already in Blob.
 * A complete row is not written again. The original bytes are not replaced.
 */
export async function storeImageVariants(sourceUrl: string, bytes: Buffer): Promise<VariantRecord> {
  const current = await prisma.imageVariant.findUnique({
    where: { sourceUrl },
    select: { thumb480: true, thumb960: true, longest: true },
  });
  const existing: VariantRecord | null = current
    ? { thumb480: current.thumb480, thumb960: current.thumb960, longest: current.longest }
    : null;
  if (isVariantComplete(existing)) return existing as VariantRecord;

  const encoded = await encodeVariants(bytes, sourceUrl, existing);
  let thumb480 = encoded.thumb480;
  let thumb960 = encoded.thumb960;
  for (const file of encoded.uploads) {
    const blob = await put(file.pathname, file.buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/webp",
      cacheControlMaxAge: YEAR,
    });
    if (file.edge === 480) thumb480 = blob.url;
    else thumb960 = blob.url;
  }
  const saved = { thumb480, thumb960, longest: encoded.longest };
  await prisma.imageVariant.upsert({
    where: { sourceUrl },
    create: { sourceUrl, ...saved },
    update: saved,
  });
  return saved;
}
