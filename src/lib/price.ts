/**
 * Shared price parser for seller-typed prices (client and server).
 * Accepts common Kenyan formats: "100000", "100 000", "100,000", "Kshs 100 000",
 * "KES 100,000", "Ksh100000", "KSh. 100,000", "100,000/=", "80k", non-breaking spaces,
 * and ranges such as "80,000 – 120,000", "80k-120k", "80 000 to 120 000".
 * Amounts are returned in cents (subunits) so GBP decimals like 12.50 still work.
 */
export const PRICE_ERROR = "Enter a price like 100,000 or KES 100 000, or a range like 80,000 – 120,000.";
export const RANGE_ORDER_ERROR = "The first price in a range must be lower than the second.";

export type ParsedPrice =
  | { ok: true; minCents: number | null; maxCents: number | null }
  | { ok: false; error: string };

const MAX_MAJOR = 99_999_999;

function parseAmount(raw: string): number | null {
  let text = raw.trim().toLowerCase();
  text = text.replace(/^(kshs?|kes|ksh|sh|shs|£|gbp)\.?\s*/, "");
  text = text.replace(/\s*\/=?\s*$/, "").replace(/\s*\/-\s*$/, "");
  text = text.trim();
  let multiplier = 1;
  if (/k$/.test(text)) {
    multiplier = 1000;
    text = text.slice(0, -1).trim();
  }
  // Thousands separators: commas, or single spaces between 3-digit groups.
  if (/^\d{1,3}([, ]\d{3})+(\.\d{1,2})?$/.test(text)) text = text.replace(/[, ]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  if (multiplier !== 1 && !/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const major = Number(text) * multiplier;
  if (!Number.isFinite(major) || major <= 0 || major > MAX_MAJOR) return null;
  const cents = Math.round(major * 100);
  return cents > 0 ? cents : null;
}

export function parsePrice(raw: string | null | undefined): ParsedPrice {
  const text = (raw ?? "").replace(/[\u00a0\u202f\u2007]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: true, minCents: null, maxCents: null };
  const range = text.split(/\s*(?:[-\u2013\u2014]|\bto\b)\s*/i);
  if (range.length === 2 && range[0] && range[1]) {
    const min = parseAmount(range[0]);
    const max = parseAmount(range[1]);
    if (min == null || max == null) return { ok: false, error: PRICE_ERROR };
    if (min >= max) return { ok: false, error: RANGE_ORDER_ERROR };
    return { ok: true, minCents: min, maxCents: max };
  }
  if (range.length !== 1) return { ok: false, error: PRICE_ERROR };
  const single = parseAmount(text);
  if (single == null) return { ok: false, error: PRICE_ERROR };
  return { ok: true, minCents: single, maxCents: null };
}

/** Whole shillings, for KES callers. */
export function parsePriceShillings(raw: string | null | undefined) {
  const parsed = parsePrice(raw);
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    min: parsed.minCents == null ? null : Math.round(parsed.minCents / 100),
    max: parsed.maxCents == null ? null : Math.round(parsed.maxCents / 100),
  };
}

/** True when a stored price (single or range) overlaps a [lo, hi] filter, in cents. */
export function priceOverlaps(
  price: { minCents: number | null; maxCents?: number | null },
  filter: { lo?: number | null; hi?: number | null },
) {
  if (price.minCents == null) return false;
  const max = price.maxCents ?? price.minCents;
  if (filter.hi != null && price.minCents > filter.hi) return false;
  if (filter.lo != null && max < filter.lo) return false;
  return true;
}
