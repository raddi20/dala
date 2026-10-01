import sharp from "sharp";

/** 64-bit difference hash. A distance of 10 or less is the same photo or a close variant. */
export const DHASH_BITS = 64;
export const NEAR_DUPLICATE_DISTANCE = 10;

const HEX_64 = /^[0-9a-f]{16}$/i;

export function photoHashEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MOD_PHOTO_HASH === "1";
}

export function hammingDistance(left: string, right: string): number | null {
  if (!HEX_64.test(left) || !HEX_64.test(right)) return null;
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  const one = BigInt(1);
  const zero = BigInt(0);
  while (bits > zero) {
    count += Number(bits & one);
    bits >>= one;
  }
  return count;
}

export function isNearDuplicate(left: string, right: string, threshold = NEAR_DUPLICATE_DISTANCE): boolean {
  const distance = hammingDistance(left, right);
  return distance !== null && distance <= threshold;
}

/**
 * Raw dHash of the pixels, stored as 16 hex characters. Not an HMAC: a few flipped bits stay close.
 * Returns null when the bytes are not an image.
 */
export async function dHash(bytes: Uint8Array): Promise<string | null> {
  try {
    const { data, info } = await sharp(Buffer.from(bytes), { failOn: "none" })
      .rotate()
      .grayscale()
      .resize(9, 8, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 9 || info.height !== 8 || info.channels !== 1) return null;
    let bits = BigInt(0);
    const one = BigInt(1);
    const zero = BigInt(0);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = data[y * 9 + x] ?? 0;
        const right = data[y * 9 + x + 1] ?? 0;
        bits = (bits << one) | (left > right ? one : zero);
      }
    }
    return bits.toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

export function matchingListingIds(
  photoHash: string,
  rows: { listingId: string; photoHash: string }[],
  listingId: string,
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (!row.listingId || row.listingId === listingId) continue;
    if (!isNearDuplicate(photoHash, row.photoHash)) continue;
    if (!ids.includes(row.listingId)) ids.push(row.listingId);
    if (ids.length >= 5) break;
  }
  return ids;
}
