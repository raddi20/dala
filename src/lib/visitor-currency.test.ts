import assert from "node:assert/strict";
import test from "node:test";
import {
  approxBesideCharge,
  cachedUsdRates,
  currencyForCountry,
  localFx,
  parseOpenErApi,
  visitorPrice,
} from "@/lib/visitor-currency";

const kes = { amount: 1500, label: "KES 1,500" };
const gbp = { amount: 12, label: "£12" };
const proKes = { amount: 2500, label: "KES 2,500" };
const proGbp = { amount: 20, label: "£20" };

test("country headers map to a currency, and unknown countries do not", () => {
  assert.equal(currencyForCountry("KE"), "KES");
  assert.equal(currencyForCountry("ke"), "KES");
  assert.equal(currencyForCountry("GB"), "GBP");
  assert.equal(currencyForCountry("US"), "USD");
  assert.equal(currencyForCountry("DE"), "EUR");
  assert.equal(currencyForCountry("UG"), "UGX");
  assert.equal(currencyForCountry(null), null);
  assert.equal(currencyForCountry(""), null);
  assert.equal(currencyForCountry("USA"), null);
  assert.equal(currencyForCountry("XX"), null);
});

test("Kenya and Britain see the real charge, with no approximate mark", () => {
  const kenya = visitorPrice({ country: "KE", kes, gbp, rates: null, kesPerUsd: 129 });
  assert.equal(kenya.kind, "exact");
  if (kenya.kind === "exact") {
    assert.equal(kenya.label, "KES 1,500");
    assert.equal(kenya.label.includes("≈"), false);
    assert.match(kenya.caption, /Kenyan shillings/);
  }
  const britain = visitorPrice({ country: "GB", kes: proKes, gbp: proGbp, rates: null, kesPerUsd: 129 });
  assert.equal(britain.kind, "exact");
  if (britain.kind === "exact") {
    assert.equal(britain.label, "£20");
    assert.equal(britain.label.includes("≈"), false);
    assert.match(britain.caption, /pounds/);
  }
});

test("other countries see one approximate figure, and a missing rate falls back to the charges", () => {
  const us = visitorPrice({
    country: "US",
    kes: proKes,
    gbp: proGbp,
    rates: null,
    kesPerUsd: 129,
  });
  assert.equal(us.kind, "approx");
  if (us.kind === "approx") {
    assert.equal(us.label, "≈ $19");
    assert.match(us.caption, /Approximate/);
    assert.match(us.caption, /Kenyan shillings/);
    assert.match(us.caption, /pounds/);
    assert.equal(us.caption.includes("FX_"), false);
  }

  const de = visitorPrice({
    country: "DE",
    kes: proKes,
    gbp: proGbp,
    rates: { USD: 1, KES: 129, EUR: 0.92 },
    kesPerUsd: 129,
  });
  assert.equal(de.kind, "approx");
  if (de.kind === "approx") assert.equal(de.label, "≈ €18");

  const offline = visitorPrice({ country: "DE", kes, gbp, rates: null, kesPerUsd: 129 });
  assert.equal(offline.kind, "charges");
  if (offline.kind === "charges") {
    assert.equal(offline.kesLabel, "KES 1,500");
    assert.equal(offline.gbpLabel, "£12");
  }

  const unknown = visitorPrice({ country: null, kes, gbp, rates: { USD: 1, EUR: 0.9 }, kesPerUsd: 129 });
  assert.equal(unknown.kind, "charges");
});

test("the promote form keeps the exact charge and may add an approximate local figure", () => {
  const us = localFx({ country: "US", rates: null, kesPerUsd: 129, kesPerGbp: 170 });
  assert.equal(approxBesideCharge({ amount: 2500, currency: "KES" }, us), "≈ $19");
  assert.equal(approxBesideCharge({ amount: 20, currency: "GBP" }, us), "≈ $26");

  const ke = localFx({ country: "KE", rates: null, kesPerUsd: 129, kesPerGbp: 170 });
  assert.equal(approxBesideCharge({ amount: 1500, currency: "KES" }, ke), null);
  assert.match(approxBesideCharge({ amount: 12, currency: "GBP" }, ke) ?? "", /^≈ KES /);

  const gb = localFx({ country: "GB", rates: null, kesPerUsd: 129, kesPerGbp: 170 });
  assert.equal(approxBesideCharge({ amount: 12, currency: "GBP" }, gb), null);

  const deOffline = localFx({ country: "DE", rates: null, kesPerUsd: 129, kesPerGbp: 170 });
  assert.equal(approxBesideCharge({ amount: 1500, currency: "KES" }, deOffline), null);

  const unknown = localFx({ country: null, rates: { USD: 1, EUR: 0.9 }, kesPerUsd: 129, kesPerGbp: 170 });
  assert.equal(approxBesideCharge({ amount: 1500, currency: "KES" }, unknown), null);
});

test("the daily feed parses a success payload and ignores anything else", () => {
  assert.deepEqual(parseOpenErApi({ result: "success", rates: { USD: 1, EUR: 0.9, KES: 129 } }), {
    USD: 1,
    EUR: 0.9,
    KES: 129,
  });
  assert.equal(parseOpenErApi({ result: "error", rates: { USD: 1 } }), null);
  assert.equal(parseOpenErApi({ result: "success", rates: { EUR: 0.9 } }), null);
  assert.equal(parseOpenErApi(null), null);
});

test("rates are cached for 24 hours, and a failed fetch does not invent a rate", async () => {
  const store: { current: { at: number; rates: Record<string, number> } | null } = { current: null };
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ result: "success", rates: { USD: 1, EUR: 0.5 } }) };
  };
  const first = await cachedUsdRates({ now: 1_000, fetcher, store });
  const second = await cachedUsdRates({ now: 1_000 + 60_000, fetcher, store });
  assert.equal(calls, 1);
  assert.equal(second?.EUR, 0.5);
  assert.equal(first?.USD, 1);

  const later = await cachedUsdRates({
    now: 1_000 + 24 * 60 * 60 * 1000,
    fetcher: async () => ({ ok: false, json: async () => ({}) }),
    store,
  });
  assert.equal(later, null);

  const broken = await cachedUsdRates({
    now: 5_000,
    fetcher: async () => {
      throw new Error("offline");
    },
    store: { current: null },
  });
  assert.equal(broken, null);
});
