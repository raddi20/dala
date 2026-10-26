import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrice, parsePriceShillings, priceOverlaps, PRICE_ERROR, RANGE_ORDER_ERROR } from "./price";
import { formatOfferingPrice, centsToInput } from "./utils";

const singles: [string, number][] = [
  ["100000", 100000], ["100 000", 100000], ["100,000", 100000], ["Kshs 100 000", 100000],
  ["kshs 100 000", 100000], ["KES 100,000", 100000], ["Ksh100000", 100000], ["KSh. 100,000", 100000],
  ["100\u00a0000", 100000], ["KES\u00a0100\u202f000", 100000], ["100,000/=", 100000], ["Ksh 100 000 /=", 100000],
  ["80k", 80000], ["80K", 80000], ["1.5k", 1500], ["  450  ", 450], ["1,234,567", 1234567],
];
for (const [input, expected] of singles) {
  test(`single: ${JSON.stringify(input)}`, () => {
    assert.deepEqual(parsePriceShillings(input), { ok: true, min: expected, max: null });
  });
}

const ranges: [string, number, number][] = [
  ["80,000 – 120,000", 80000, 120000], ["80k-120k", 80000, 120000], ["80 000 to 120 000", 80000, 120000],
  ["KES 80,000 - 120,000", 80000, 120000], ["Ksh 80,000 — Ksh 120,000/=", 80000, 120000],
];
for (const [input, min, max] of ranges) {
  test(`range: ${JSON.stringify(input)}`, () => {
    assert.deepEqual(parsePriceShillings(input), { ok: true, min, max });
  });
}

test("empty is allowed (no price)", () => {
  assert.deepEqual(parsePrice("  "), { ok: true, minCents: null, maxCents: null });
});

test("GBP decimals still work", () => {
  assert.deepEqual(parsePrice("12.50"), { ok: true, minCents: 1250, maxCents: null });
});

for (const bad of ["abc", "0", "-5", "100,00", "10 0000", "KES", "1.234", "100000000", "1-2-3", "80k-", "Ksh 0 - 5"]) {
  test(`invalid: ${JSON.stringify(bad)}`, () => {
    assert.deepEqual(parsePrice(bad), { ok: false, error: PRICE_ERROR });
  });
}

test("range must ascend", () => {
  assert.deepEqual(parsePrice("120k - 80k"), { ok: false, error: RANGE_ORDER_ERROR });
  assert.deepEqual(parsePrice("100 - 100"), { ok: false, error: RANGE_ORDER_ERROR });
});

test("format single unchanged, range formats both ends", () => {
  assert.equal(formatOfferingPrice(10000000, "KES"), "KES 100,000");
  assert.equal(formatOfferingPrice(8000000, "KES", 12000000), "KSh 80,000 – 120,000");
  assert.equal(formatOfferingPrice(4000, "GBP", 6050), "£40 – £60.50");
  assert.equal(formatOfferingPrice(null, "KES", 500), "");
});

test("edit input round-trips a range", () => {
  assert.equal(centsToInput(8000000, 12000000), "80000 – 120000");
  assert.equal(centsToInput(8000000), "80000");
});

test("filters include overlapping ranges", () => {
  const range = { minCents: 80000, maxCents: 120000 };
  assert.equal(priceOverlaps(range, { lo: 100000, hi: 200000 }), true);
  assert.equal(priceOverlaps(range, { lo: 0, hi: 90000 }), true);
  assert.equal(priceOverlaps(range, { lo: 130000 }), false);
  assert.equal(priceOverlaps(range, { hi: 70000 }), false);
  assert.equal(priceOverlaps({ minCents: 50000 }, { lo: 40000, hi: 60000 }), true);
  assert.equal(priceOverlaps({ minCents: 50000, maxCents: null }, { lo: 60000 }), false);
});
