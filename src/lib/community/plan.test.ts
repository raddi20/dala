import assert from "node:assert/strict";
import test from "node:test";
import { COMMUNITY_PRO_GATE, updatesAllowed } from "@/lib/community/plan";

const now = new Date("2026-11-25T09:00:00.000Z");

test("the pro gate is off, so every shop can post", () => {
  assert.equal(COMMUNITY_PRO_GATE, false);
  const postedAt = [now, new Date(now.getTime() - 60_000), new Date(now.getTime() - 3_600_000)];
  assert.deepEqual(updatesAllowed({ pro: false, now, postedAt }), { ok: true });
  assert.deepEqual(updatesAllowed({ pro: true, now, postedAt }), { ok: true });
});

test("when the gate is forced on, a free shop is weekly and a pro shop is daily", () => {
  const postedAt = [new Date(now.getTime() - 60_000)];
  const free = updatesAllowed({ pro: false, now, postedAt, gate: true });
  assert.equal(free.ok, false);
  const pro = updatesAllowed({ pro: true, now, postedAt, gate: true });
  assert.equal(pro.ok, false);
  const quiet = updatesAllowed({ pro: false, now, postedAt: [new Date(now.getTime() - 8 * 86_400_000)], gate: true });
  assert.equal(quiet.ok, true);
});
