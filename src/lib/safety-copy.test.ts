import { test } from "node:test";
import assert from "node:assert/strict";
import { MPESA_SAFETY_NOTE, MPESA_TIPS, SAFETY_TIPS, VERIFICATION_EXPLAINER } from "@/lib/safety";
import { PRICE_ON_REQUEST, itemPriceText } from "@/lib/item-card";

const allCopy = JSON.stringify({ MPESA_SAFETY_NOTE, MPESA_TIPS, SAFETY_TIPS, VERIFICATION_EXPLAINER });

test("verification and M-Pesa copy has no escrow or funeral terms", () => {
  assert.doesNotMatch(allCopy, /escrow|funeral|burial|mourn|matanga|wake/i);
});

test("verification explainer covers each badge and says paid plans are not badges", () => {
  const labels = VERIFICATION_EXPLAINER.points.map((p) => p.label);
  assert.deepEqual(labels, ["Phone verified", "Location verified", "Business verified"]);
  assert.match(VERIFICATION_EXPLAINER.limits.join(" "), /not verification badges/);
});

test("M-Pesa tips include buyer and seller guidance", () => {
  assert.ok(MPESA_TIPS.buyers.length >= 3);
  assert.ok(MPESA_TIPS.sellers.length >= 3);
  assert.match(MPESA_TIPS.sellers.join(" "), /PIN/);
});

test("missing price falls back to Price on request, never an invented amount", () => {
  for (const empty of [undefined, null, "", "   "]) {
    assert.deepEqual(itemPriceText(empty), { text: PRICE_ON_REQUEST, ask: true });
  }
  assert.equal(PRICE_ON_REQUEST, "Price on request");
  assert.deepEqual(itemPriceText(" KES 1,500 "), { text: "KES 1,500", ask: false });
});
