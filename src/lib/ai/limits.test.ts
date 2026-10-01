import assert from "node:assert/strict";
import test from "node:test";
import { countInWindow, isDebounced, MODERATION_DEBOUNCE_MS, overWindow, rateWindows } from "@/lib/ai/limits";

test("rate windows drop events that are older than the window", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const recent = Array.from({ length: 20 }, (_, index) => now - index * 1000);
  assert.equal(overWindow(recent, now, hour, 20), true);
  assert.equal(overWindow(recent.slice(0, 19), now, hour, 20), false);
  const old = [now - hour - 1, ...recent.slice(0, 19)];
  assert.equal(countInWindow(old, now, hour), 19);
  assert.equal(overWindow(old, now, hour, 20), false);

  const search = rateWindows("smart_search");
  assert.equal(search[0]?.limit, 20);
  assert.equal(search[0]?.windowMs, hour);
  assert.equal(search[1]?.limit, 3000);
  assert.equal(search[1]?.windowMs, day);
  assert.equal(rateWindows("family_helper")[0]?.limit, 10);
  assert.equal(rateWindows("listing_writer")[0]?.limit, 15);
  assert.equal(rateWindows("listing_writer")[1]?.limit, 100);
  assert.equal(rateWindows("moderation")[0]?.limit, 50);
  assert.equal(rateWindows("seller_tips").length, 0);
});

test("a moderation check inside ten minutes is debounced", () => {
  const now = 1_000_000;
  assert.equal(isDebounced(null, now), false);
  assert.equal(isDebounced(now - MODERATION_DEBOUNCE_MS + 1, now), true);
  assert.equal(isDebounced(now - MODERATION_DEBOUNCE_MS, now), false);
});
