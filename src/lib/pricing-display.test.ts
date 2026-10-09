import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CHARGE, FEATURED_DAYS, FREE_OFFERING_CAP, PRO_DAYS, PRO_OFFERING_CAP } from "@/lib/constants";
import {
  DEFAULT_KES_PER_GBP,
  DEFAULT_KES_PER_USD,
  approximateFromKes,
  kesPerUsd,
  planPriceLines,
  priceLinesForCharge,
  pricingPlans,
  pricingRateNote,
} from "@/lib/pricing-display";

test("featured and pro prices come from the checkout charge table", () => {
  const featured = planPriceLines("featured", {});
  const pro = planPriceLines("verified_pro", {});
  assert.equal(featured.kes.label, CHARGE.featured.Nairobi.label);
  assert.equal(featured.kes.amount, CHARGE.featured.Nairobi.amount);
  assert.equal(featured.kes.approximate, false);
  assert.equal(featured.gbp.label, CHARGE.featured.London.label);
  assert.equal(featured.gbp.approximate, false);
  assert.equal(pro.kes.label, CHARGE.verified_pro.Nairobi.label);
  assert.equal(pro.kes.amount, 2500);
  assert.equal(pro.gbp.label, "£20");
  assert.equal(pro.gbp.approximate, false);
  assert.equal(featured.gbp.label, "£12");
  assert.equal(featured.kes.label, "KES 1,500");
});

test("USD is approximate from the shilling amount and the documented rate", () => {
  const featured = planPriceLines("featured", {});
  const pro = planPriceLines("verified_pro", {});
  assert.equal(DEFAULT_KES_PER_USD, 129);
  assert.equal(featured.usd.approximate, true);
  assert.equal(featured.usd.label, approximateFromKes(CHARGE.featured.Nairobi.amount, 129, "US$"));
  assert.equal(featured.usd.label, "about US$12");
  assert.equal(pro.usd.label, "about US$19");
  assert.match(featured.usd.label, /^about /);
});

test("FX_KES_PER_USD overrides the approximate dollar amount", () => {
  const priced = planPriceLines("featured", { FX_KES_PER_USD: "100" });
  assert.equal(kesPerUsd({ FX_KES_PER_USD: "100" }), 100);
  assert.equal(priced.usd.label, "about US$15");
  assert.equal(priced.gbp.label, CHARGE.featured.London.label);
  assert.equal(kesPerUsd({ FX_KES_PER_USD: "nope" }), DEFAULT_KES_PER_USD);
  assert.equal(kesPerUsd({ FX_KES_PER_USD: "0" }), DEFAULT_KES_PER_USD);
});

test("a missing pound price is marked approximate and uses FX_KES_PER_GBP", () => {
  const lines = priceLinesForCharge({ amount: 1500, label: "KES 1,500" }, null, {
    kesPerUsd: DEFAULT_KES_PER_USD,
    kesPerGbp: DEFAULT_KES_PER_GBP,
  });
  assert.equal(lines.gbp.approximate, true);
  assert.equal(lines.gbp.label, approximateFromKes(1500, DEFAULT_KES_PER_GBP, "£"));
  assert.match(lines.gbp.label, /^about £/);
});

test("plan copy uses the real offering caps and says Pro is not verified", () => {
  const plans = pricingPlans({});
  const featured = plans.find((plan) => plan.product === "featured");
  const pro = plans.find((plan) => plan.product === "verified_pro");
  assert.ok(featured);
  assert.ok(pro);
  assert.match(featured.includes.join(" "), new RegExp(String(FEATURED_DAYS)));
  assert.match(pro.includes.join(" "), new RegExp(String(PRO_OFFERING_CAP)));
  assert.match(pro.includes.join(" "), new RegExp(String(FREE_OFFERING_CAP)));
  assert.match(pro.includes.join(" "), new RegExp(String(PRO_DAYS)));
  assert.match(pro.summary, /per 30 days/i);
  assert.match(pro.summary, /KES 2,500/);
  assert.match(pro.summary, /£20/);
  assert.equal(pro.period, `per ${PRO_DAYS} days`);
  assert.match(pro.includes.join(" "), /adds another 30 days/i);
  assert.match(pro.summary, /not a verification badge/i);
  assert.match(pro.notIncluded.join(" "), /does not mean the shop is verified/i);
  assert.match(pricingRateNote({}), new RegExp(String(DEFAULT_KES_PER_USD)));
  assert.match(pricingRateNote({}), /the Diaspora charge/);
  assert.equal(pricingRateNote({}).includes("London charge"), false);
  assert.match(pricingRateNote({ FX_KES_PER_USD: "140" }), /140 shillings/);
  assert.equal(/FX_|process\.env|default \d+/.test(pricingRateNote({})), false);
  assert.equal(/FX_|process\.env/.test(pricingRateNote({ FX_KES_PER_USD: "140" })), false);
});

test("the pricing page and promote form name the pound price for Diaspora shops", () => {
  const pricing = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
  const promote = readFileSync(new URL("../components/pay-form.tsx", import.meta.url), "utf8");
  assert.match(pricing, /Diaspora price/);
  assert.equal(pricing.includes("London price"), false);
  assert.match(promote, /for Diaspora shops/);
  assert.equal(promote.includes("in London"), false);
});
