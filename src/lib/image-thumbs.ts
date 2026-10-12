import sharp from "sharp";
import {
  isVariantComplete,
  thumbsNeeded,
  variantPathname,
  type ThumbEdge,
  type VariantRecord,
} from "@/lib/image-variants";

export type ThumbFile = {
  edge: ThumbEdge;
  pathname: string;
  buffer: Buffer;
};

export type EncodedVariants = {
  skipped: boolean;
  longest: number;
  thumb480: string | null;
  thumb960: string | null;
  uploads: ThumbFile[];
};

/**
 * Build smaller WebP files from the original bytes. The original is not
 * re-encoded: the photo editor already compressed it, and this only writes
 * a derivative when the longest side is larger than the target.
 */
export async function buildThumbBuffers(bytes: Buffer): Promise<{
  width: number;
  height: number;
  longest: number;
  thumbs: { edge: ThumbEdge; buffer: Buffer }[];
}> {
  const meta = await sharp(bytes, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const longest = Math.max(width, height);
  const thumbs: { edge: ThumbEdge; buffer: Buffer }[] = [];
  for (const edge of thumbsNeeded(longest)) {
    const buffer = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75, effort: 4 })
      .toBuffer();
    thumbs.push({ edge, buffer });
  }
  return { width, height, longest, thumbs };
}

export async function encodeVariants(
  bytes: Buffer,
  sourceUrl: string,
  existing: VariantRecord | null,
): Promise<EncodedVariants> {
  if (isVariantComplete(existing)) {
    return {
      skipped: true,
      longest: existing?.longest ?? 0,
      thumb480: existing?.thumb480 ?? null,
      thumb960: existing?.thumb960 ?? null,
      uploads: [],
    };
  }
  const built = await buildThumbBuffers(bytes);
  const uploads: ThumbFile[] = [];
  for (const thumb of built.thumbs) {
    const already = thumb.edge === 480 ? existing?.thumb480 : existing?.thumb960;
    if (already) continue;
    const pathname = variantPathname(sourceUrl, thumb.edge);
    if (!pathname) continue;
    uploads.push({ edge: thumb.edge, pathname, buffer: thumb.buffer });
  }
  return {
    skipped: false,
    longest: built.longest,
    thumb480: existing?.thumb480 ?? null,
    thumb960: existing?.thumb960 ?? null,
    uploads,
  };
}
