import sharp from "sharp";

/** WhatsApp ignores og:video and drops previews over about 600 KB. */
export const OG_JPEG_LIMIT = 600_000;

export async function jpegUnderLimit(png: Buffer, limit = OG_JPEG_LIMIT) {
  let quality = 80;
  let jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
  while (jpeg.byteLength > limit && quality > 40) {
    quality -= 10;
    jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  if (jpeg.byteLength > limit) {
    jpeg = await sharp(png).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 40, mozjpeg: true }).toBuffer();
  }
  return jpeg;
}
