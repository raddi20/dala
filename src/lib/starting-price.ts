/** Starting price copy. Shillings are written "from Ksh 500", with a thousands comma. */

export function fromKsh(amount: number | null | undefined): string {
  if (amount == null || !Number.isInteger(amount) || amount <= 0) return "";
  const grouped = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `from Ksh ${grouped}`;
}

/** A whole shilling amount from "500", "1,500", "Ksh 500", or "from Ksh 1,500". */
export function parseStartingPriceKes(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const match =
    /^(?:from\s+)?(?:ksh|kes)\s*(\d{1,3}(?:,\d{3})*|\d+)$/i.exec(text) || /^(\d{1,3}(?:,\d{3})*|\d+)$/.exec(text);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) return null;
  return amount;
}

/** Card and shop-page line. The structured amount wins. A free-text label is kept when it is not a plain shilling figure. */
export function shownPrice(input: { startingPriceKes?: number | null; priceLabel?: string | null }): string {
  const from = fromKsh(input.startingPriceKes);
  if (from) return from;
  return (input.priceLabel ?? "").trim();
}

/**
 * Listing form: a plain shilling figure is stored as the structured amount and as "from Ksh X".
 * Anything else (a pound price, "an hour") stays free text and leaves the amount empty.
 */
export function startingPriceFromInput(raw: string): { priceLabel: string; startingPriceKes: number | null } {
  const trimmed = raw.trim().slice(0, 40);
  const amount = parseStartingPriceKes(trimmed);
  if (amount == null) return { priceLabel: trimmed, startingPriceKes: null };
  return { priceLabel: fromKsh(amount).slice(0, 40), startingPriceKes: amount };
}

/** Optional shop or listing field. Blank is allowed. A number that is not a starting price is not. */
export function readStartingPriceField(raw: string): { ok: true; amount: number | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, amount: null };
  const amount = parseStartingPriceKes(text);
  if (amount == null) return { ok: false, error: "Enter a starting price like 500, or leave it blank." };
  return { ok: true, amount };
}

/** First shilling amount in a sentence. "25k" is 25,000. A pound sign means this is not shillings. */
export function kesAmountInText(text: string): number | null {
  if (/£|\bgbp\b/i.test(text)) return null;
  const thousands = /(\d{1,6}(?:\.\d+)?)\s*k\b/i.exec(text);
  if (thousands) {
    const amount = Math.round(Number(thousands[1]) * 1000);
    return Number.isInteger(amount) && amount > 0 ? amount : null;
  }
  const plain = /(\d{1,3}(?:,\d{3})+|\d{2,9})/.exec(text);
  if (!plain) return null;
  const amount = Number(plain[1].replace(/,/g, ""));
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}
