import assert from "node:assert/strict";
import test from "node:test";
import { CHARGE } from "@/lib/constants";
import { asKshCopy, kshAmount } from "@/lib/ksh-copy";
import { kesLabel } from "@/lib/business-tiers";
import { kesLabelFromSubunit } from "@/lib/protected-order";
import { formatOfferingPrice } from "@/lib/utils";
import { approxLabel } from "@/lib/visitor-currency";
import { itemPriceText } from "@/lib/item-card";
import { shownPriceLabel } from "@/lib/crawl-copy";

test("people see Ksh, while the currency code KES stays in the words we do not rewrite", () => {
  assert.equal(asKshCopy("KES 200"), "Ksh 200");
  assert.equal(asKshCopy("From KES 450"), "From Ksh 450");
  assert.equal(asKshCopy("KSh 80,000 – 120,000"), "Ksh 80,000 – 120,000");
  assert.equal(asKshCopy("Ksh 200"), "Ksh 200");
  assert.equal(kshAmount("1,500"), "Ksh 1,500");
  assert.equal(formatOfferingPrice(20000, "KES"), "Ksh 200");
  assert.equal(formatOfferingPrice(20000, "KES", 35000), "Ksh 200 – 350");
  assert.equal(formatOfferingPrice(1200, "GBP"), "£12");
  assert.equal(itemPriceText("KES 400").text, "Ksh 400");
  assert.equal(shownPriceLabel("Consultation KES 1,000"), "Consultation Ksh 1,000");
  assert.equal(kesLabel(1500), "Ksh 1,500");
  assert.equal(kesLabelFromSubunit(170_000), "Ksh 1,700");
  assert.equal(approxLabel(1500, "KES"), "≈ Ksh 1,500");
  assert.equal(CHARGE.featured.Nairobi.currency, "KES");
  assert.equal(CHARGE.featured.Nairobi.label, "Ksh 1,500");
  assert.equal(CHARGE.verified_pro.Nairobi.label, "Ksh 2,500");
  for (const shown of [
    formatOfferingPrice(20000, "KES"),
    itemPriceText("KES 200").text,
    kesLabel(4500),
    CHARGE.featured.Nairobi.label,
  ]) {
    assert.equal(/\bKES\b/.test(shown), false, shown);
    assert.match(shown, /\bKsh\b/);
  }
});
