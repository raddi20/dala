import assert from "node:assert/strict";
import test from "node:test";
import { looksLikeUsername, suggestBusinessName, tidyBusinessName } from "@/lib/business-name";
import { fromKsh, kesAmountInText, parseStartingPriceKes, shownPrice, startingPriceFromInput } from "@/lib/starting-price";

test("username-style names are the lowercase handles with a digit or underscore", () => {
  assert.equal(looksLikeUsername("kevo_254"), true);
  assert.equal(looksLikeUsername("shop254"), true);
  assert.equal(looksLikeUsername("Akinyi Catering"), false);
  assert.equal(looksLikeUsername("mama"), false);
  assert.equal(looksLikeUsername("Atieno Odhiambo"), false);
  assert.equal(tidyBusinessName("kevo_254 fish"), "Kevo Fish");
  assert.equal(suggestBusinessName("kevo_254", "Fish restaurant in Nairobi"), "Fish Restaurant In Nairobi");
  assert.equal(suggestBusinessName("Akinyi Catering", "ignored"), "Akinyi Catering");
});

test("a starting price is written from Ksh and stays optional", () => {
  assert.equal(fromKsh(500), "from Ksh 500");
  assert.equal(fromKsh(1500), "from Ksh 1,500");
  assert.equal(fromKsh(null), "");
  assert.equal(parseStartingPriceKes("from Ksh 1,500"), 1500);
  assert.equal(parseStartingPriceKes("500"), 500);
  assert.equal(parseStartingPriceKes("£40"), null);
  assert.deepEqual(startingPriceFromInput("1500"), { priceLabel: "from Ksh 1,500", startingPriceKes: 1500 });
  assert.deepEqual(startingPriceFromInput("KES 1,200 an hour"), {
    priceLabel: "KES 1,200 an hour",
    startingPriceKes: null,
  });
  assert.equal(shownPrice({ startingPriceKes: 500, priceLabel: "KES 9" }), "from Ksh 500");
  assert.equal(shownPrice({ startingPriceKes: null, priceLabel: "£40" }), "£40");
  assert.equal(kesAmountInText("Used sofa, 25k"), 25000);
  assert.equal(/funeral|escrow/i.test("from Ksh 500"), false);
});
