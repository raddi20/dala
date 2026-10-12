import assert from "node:assert/strict";
import test from "node:test";
import { firstPhoto, itemKindTag, itemPriceText, shopIsChecked, showScamChip } from "@/lib/item-card";

test("item tags, prices, shop checks, and scam chips stay to one line", () => {
  assert.equal(itemKindTag({ kind: "offering" }), "Shop");
  assert.equal(itemKindTag({ kind: "listing", type: "business", category: "Food & restaurants" }), "Shop");
  assert.equal(itemKindTag({ kind: "listing", type: "classified", category: "Real estate / housing" }), "Housing");
  assert.equal(itemKindTag({ kind: "listing", type: "goods", category: "Retail / shops" }), "For sale");
  assert.deepEqual(itemPriceText("KES 400"), { text: "KES 400", ask: false });
  assert.deepEqual(itemPriceText("  "), { text: "Ask for price", ask: true });
  assert.equal(shopIsChecked({ phoneVerified: true }), true);
  assert.equal(shopIsChecked({}), false);
  assert.equal(showScamChip("low"), false);
  assert.equal(showScamChip("medium"), true);
  assert.equal(showScamChip("high"), true);
  assert.equal(firstPhoto(["", "  ", "https://cdn.example/a.jpg"]), "https://cdn.example/a.jpg");
  assert.equal(firstPhoto([]), "");
});
