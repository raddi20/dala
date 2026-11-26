import assert from "node:assert/strict";
import test from "node:test";
import { holdForFlags, judgementFromModeration } from "@/lib/community/moderate";

test("medium and high moderation flags hold an update", () => {
  assert.deepEqual(holdForFlags([{ kind: "other", severity: "low", reason: "fine" }]), { hold: false, reason: "" });
  const held = holdForFlags([{ kind: "scam_text", severity: "high", reason: "Asks for a deposit" }]);
  assert.equal(held.hold, true);
  assert.match(held.reason, /deposit/);
});

test("a flagged moderation result is pending, and a clean or failed one is public", () => {
  const pending = judgementFromModeration({
    ok: true,
    data: { flags: [{ kind: "misleading", severity: "medium", reason: "Not about the shop" }] },
  });
  assert.equal(pending.status, "pending");
  assert.equal(pending.flags.length, 1);
  assert.equal(judgementFromModeration({ ok: true, data: { flags: [] } }).status, "approved");
  assert.equal(judgementFromModeration({ ok: false }).status, "approved");
  assert.equal(judgementFromModeration(null).status, "approved");
});
