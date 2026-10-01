import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  dHash,
  hammingDistance,
  isNearDuplicate,
  NEAR_DUPLICATE_DISTANCE,
  photoHashEnabled,
} from "@/lib/ai/photo-hash";

test("MOD_PHOTO_HASH is on only when the flag is exactly 1", () => {
  assert.equal(photoHashEnabled({ MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(photoHashEnabled({ MOD_PHOTO_HASH: "mod-photo-hash-secret" } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(photoHashEnabled({} as NodeJS.ProcessEnv), false);
});

test("hashes within 10 bits match and the 11th bit does not", () => {
  assert.equal(hammingDistance("0000000000000000", "0000000000000001"), 1);
  assert.equal(isNearDuplicate("0000000000000000", "00000000000003ff"), true);
  assert.equal(hammingDistance("0000000000000000", "00000000000003ff"), 10);
  assert.equal(isNearDuplicate("0000000000000000", "00000000000007ff"), false);
  assert.equal(NEAR_DUPLICATE_DISTANCE, 10);
  assert.equal(hammingDistance("abcd", "0000000000000001"), null);
});

async function picture(shift: number) {
  const width = 48;
  const height = 48;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const value = Math.min(255, x * 5 + shift);
      raw[i] = value;
      raw[i + 1] = value;
      raw[i + 2] = 255 - value;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } });
}

test("a recompressed photo matches and a different picture does not", async () => {
  const source = await picture(0);
  const png = new Uint8Array(await source.clone().png().toBuffer());
  const jpeg = new Uint8Array(await source.clone().jpeg({ quality: 30 }).toBuffer());
  const original = await dHash(png);
  const compressed = await dHash(jpeg);
  assert.ok(original);
  assert.equal(original?.length, 16);
  assert.ok(compressed);
  assert.equal(isNearDuplicate(original ?? "", compressed ?? ""), true);

  const width = 48;
  const height = 48;
  const checks = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const on = (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0 ? 255 : 0;
      checks[i] = on;
      checks[i + 1] = on;
      checks[i + 2] = on;
    }
  }
  const other = new Uint8Array(await sharp(checks, { raw: { width, height, channels: 3 } }).jpeg().toBuffer());
  const far = await dHash(other);
  assert.ok(far);
  assert.equal(isNearDuplicate(original ?? "", far ?? ""), false);
  assert.equal(await dHash(new Uint8Array([1, 2, 3])), null);
});
