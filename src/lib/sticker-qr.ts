import { encode } from "uqr";

/** Q recovers about 25% damage. Enough for a sticker on a cheap phone camera. */
export const STICKER_ECC = "Q" as const;
/** Quiet zone in modules. Spec minimum is 4. */
export const STICKER_QUIET = 4;

export type QrDrawing = {
  size: number;
  /** SVG path of the dark modules, in module units, including the quiet zone. */
  path: string;
};

export function qrDrawing(text: string): QrDrawing {
  const qr = encode(text, { ecc: STICKER_ECC, border: 0, boostEcc: false });
  const quiet = STICKER_QUIET;
  const size = qr.size + quiet * 2;
  let path = "";
  for (let y = 0; y < qr.size; y += 1) {
    const row = qr.data[y];
    if (!row) continue;
    for (let x = 0; x < qr.size; x += 1) {
      if (row[x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return { size, path };
}
