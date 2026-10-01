import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { photoFingerprint } from "@/lib/ai/photo-hash";

test("a photo fingerprint is an HMAC and is skipped without a long secret", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const hash = photoFingerprint(bytes, "mod-photo-hash-secret");
  assert.equal(hash?.length, 64);
  assert.notEqual(hash, createHash("sha256").update(bytes).digest("hex"));
  assert.notEqual(hash, photoFingerprint(bytes, "another-long-secret"));
  assert.equal(photoFingerprint(bytes, "short"), null);
  assert.equal(photoFingerprint(bytes, ""), null);
});
