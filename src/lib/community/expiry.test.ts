import assert from "node:assert/strict";
import test from "node:test";
import { UPDATE_TTL_DAYS, expiredUpdateIds, updateExpiresAt, updateIsPublic } from "@/lib/community/expiry";

test("an update expires 60 days after it is posted and drops out of reads immediately", () => {
  const posted = new Date("2026-01-01T00:00:00.000Z");
  const expires = updateExpiresAt(posted);
  assert.equal((expires.getTime() - posted.getTime()) / 86_400_000, UPDATE_TTL_DAYS);
  assert.equal(updateIsPublic({ status: "approved", expiresAt: expires }, new Date(expires.getTime() - 1)), true);
  assert.equal(updateIsPublic({ status: "approved", expiresAt: expires }, expires), false);
  assert.equal(updateIsPublic({ status: "pending", expiresAt: expires }, posted), false);
  assert.deepEqual(expiredUpdateIds([{ id: "a", expiresAt: posted }, { id: "b", expiresAt: expires }], expires), ["a", "b"]);
});
