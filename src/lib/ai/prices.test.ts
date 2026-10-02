import assert from "node:assert/strict";
import test from "node:test";
import { costMicroUsd, lookupPrice } from "@/lib/ai/prices";

test("token cost is tokens times the per-million price, rounded up", () => {
  const flash = lookupPrice("gemini", "gemini-3.5-flash-lite").price;
  assert.equal(costMicroUsd(1000, 100, flash), 550);
  assert.equal(costMicroUsd(1000, 100, flash, true), 275);
  assert.equal(costMicroUsd(1, 0, flash), 1);
  const luna = lookupPrice("openai", "gpt-6-luna").price;
  assert.equal(costMicroUsd(1_000_000, 1_000_000, luna), 600_000);
});

test("an unknown model uses that provider's highest known price", () => {
  const unknown = lookupPrice("gemini", "gemini-new");
  assert.equal(unknown.price.inPerM, 0.75);
  assert.equal(unknown.price.outPerM, 3.75);
  assert.match(unknown.warning ?? "", /highest known/);
  const compat = lookupPrice("openai_compat", "local", { inPerM: 0, outPerM: 0 });
  assert.equal(costMicroUsd(5000, 5000, compat.price), 0);
  assert.equal(compat.warning, null);
});
