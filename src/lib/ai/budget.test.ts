import assert from "node:assert/strict";
import test from "node:test";
import { budgetCapMicro, budgetTier, featureBlockedByBudget, wouldCrossBudget } from "@/lib/ai/budget";

test("budget tiers turn public features off at 80 percent and everything off at 100 percent", () => {
  const cap = budgetCapMicro(10);
  assert.equal(budgetTier(0, 10), "ok");
  assert.equal(budgetTier(cap * 0.8 - 1, 10), "ok");
  assert.equal(budgetTier(cap * 0.8, 10), "public_off");
  assert.equal(budgetTier(cap - 1, 10), "public_off");
  assert.equal(budgetTier(cap, 10), "all_off");
  assert.equal(budgetTier(0, 0), "all_off");
  assert.equal(featureBlockedByBudget("smart_search", "public_off"), true);
  assert.equal(featureBlockedByBudget("family_helper", "public_off"), true);
  assert.equal(featureBlockedByBudget("listing_writer", "public_off"), false);
  assert.equal(featureBlockedByBudget("moderation", "all_off"), true);
  assert.equal(featureBlockedByBudget("listing_writer", "ok"), false);
});

test("a call that would cross the cap is blocked before it is sent", () => {
  const cap = budgetCapMicro(10);
  assert.equal(wouldCrossBudget(cap - 100, 100, 10), true);
  assert.equal(wouldCrossBudget(cap - 101, 100, 10), false);
  assert.equal(wouldCrossBudget(0, 1, 0), true);
});
