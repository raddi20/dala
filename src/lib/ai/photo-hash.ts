import sharp from "sharp";

/** 64-bit difference hash. Six differing bits or fewer is the same photo. */
export const DHASH_BITS = 64;
export const NEAR_DUPLICATE_DISTANCE = 6;

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

export type HashChunks = { h0: string; h1: string; h2: string; h3: string };

/** Four 16-bit pieces of a 64-bit dHash, used to look up candidates. */
export function hashChunks(dhash: string): HashChunks | null {
  if (!HEX_64.test(dhash)) return null;
  const hex = dhash.toLowerCase();
  return { h0: hex.slice(0, 4), h1: hex.slice(4, 8), h2: hex.slice(8, 12), h3: hex.slice(12, 16) };
}

export type HashCandidate = {
  ownerType: string;
  ownerId: string;
  ownerUser: string;
  dhash: string;
};

/**
 * Near-duplicates of another owner. A candidate must share one 16-bit chunk, then sit within 6 bits.
 * The same owner's photos are ignored.
 */
export function otherOwnerMatches(dhash: string, ownerUser: string, rows: HashCandidate[]): HashCandidate[] {
  const chunks = hashChunks(dhash);
  if (!chunks || !ownerUser) return [];
  const matches: HashCandidate[] = [];
  for (const row of rows) {
    if (!row.ownerUser || row.ownerUser === ownerUser) continue;
    const parts = hashChunks(row.dhash);
    if (!parts) continue;
    const shares =
      parts.h0 === chunks.h0 || parts.h1 === chunks.h1 || parts.h2 === chunks.h2 || parts.h3 === chunks.h3;
    if (!shares || !isNearDuplicate(dhash, row.dhash)) continue;
    matches.push(row);
    if (matches.length >= 5) break;
  }
  return matches;
}
