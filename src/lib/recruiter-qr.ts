import sharp from "sharp";
import { qrDrawing } from "@/lib/sticker-qr";

/** Download size. The quiet zone is included, so the file is at least this many pixels on a side. */
export const RECRUITER_QR_PNG_PX = 1024;
/** Print view. Larger than the download so a paper copy stays sharp. */
export const RECRUITER_QR_PRINT_PX = 1536;

export function recruiterQrPixels(raw: string | null | undefined, fallback = RECRUITER_QR_PNG_PX) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 256 || n > 2048) return fallback;
  return n;
}

/** PNG of the QR for `text`. No paid service. The same drawing the sticker QR uses. */
export async function recruiterQrPng(text: string, pixels = RECRUITER_QR_PNG_PX): Promise<Buffer> {
  const drawing = qrDrawing(text);
  const scale = Math.max(1, Math.ceil(pixels / drawing.size));
  const dim = drawing.size * scale;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${drawing.size} ${drawing.size}" shape-rendering="crispEdges">
  <rect width="${drawing.size}" height="${drawing.size}" fill="#ffffff"/>
  <path d="${drawing.path}" fill="#000000"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
