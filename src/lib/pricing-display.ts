import {
  CHARGE,
  FEATURED_DAYS,
  FREE_OFFERING_CAP,
  PRO_OFFERING_CAP,
  type PaidProduct,
} from "@/lib/constants";
import { PRO_PLAN_LABEL } from "@/lib/shop-badges";

/**
 * Display rates for the public pricing page.
 *
 * Nairobi charges are Kenyan shillings and London charges are pounds. Both come
 * from CHARGE in src/lib/constants.ts, which checkout already uses. Do not copy
 * those amounts here.
 *
 * USD is not a charge currency. Convert from the Nairobi shilling amount for
 * comparison only. GBP is converted only when a product has no configured pound
 * price (both current products have one).
 *
 * Defaults: 129 shillings per US dollar, and 170 shillings per pound for the
 * fallback only. Override with FX_KES_PER_USD and FX_KES_PER_GBP. These are not
 * a live market feed.
 */
export const DEFAULT_KES_PER_USD = 129;
export const DEFAULT_KES_PER_GBP = 170;

export type PriceLine = {
  label: string;
  approximate: boolean;
  currency: "KES" | "GBP" | "USD";
};

export type PlanPrices = {
  kes: PriceLine & { amount: number };
  gbp: PriceLine;
  usd: PriceLine;
};

export type RateEnv = {
  FX_KES_PER_USD?: string;
  FX_KES_PER_GBP?: string;
};

export function positiveRate(raw: string | undefined, fallback: number) {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

export function kesPerUsd(env?: RateEnv) {
  const raw = env ? env.FX_KES_PER_USD : process.env.FX_KES_PER_USD;
  return positiveRate(raw, DEFAULT_KES_PER_USD);
}

export function kesPerGbp(env?: RateEnv) {
  const raw = env ? env.FX_KES_PER_GBP : process.env.FX_KES_PER_GBP;
  return positiveRate(raw, DEFAULT_KES_PER_GBP);
}

/** Nearest whole unit, at least 1. Prefix is "US$" or "£". */
export function approximateFromKes(amountKes: number, perUnit: number, prefix: string) {
  const rounded = Math.max(1, Math.round(amountKes / perUnit));
  return `about ${prefix}${rounded}`;
}

export function priceLinesForCharge(
  kes: { amount: number; label: string },
  gbp: { label: string } | null,
  rates: { kesPerUsd: number; kesPerGbp: number },
): PlanPrices {
  return {
    kes: { label: kes.label, amount: kes.amount, approximate: false, currency: "KES" },
    gbp: gbp
      ? { label: gbp.label, approximate: false, currency: "GBP" }
      : {
          label: approximateFromKes(kes.amount, rates.kesPerGbp, "£"),
          approximate: true,
          currency: "GBP",
        },
    usd: {
      label: approximateFromKes(kes.amount, rates.kesPerUsd, "US$"),
      approximate: true,
      currency: "USD",
    },
  };
}

export function planPriceLines(product: PaidProduct, env?: RateEnv): PlanPrices {
  const charge = CHARGE[product];
  return priceLinesForCharge(charge.Nairobi, charge.London, {
    kesPerUsd: kesPerUsd(env),
    kesPerGbp: kesPerGbp(env),
  });
}

export type PricingPlan = {
  product: PaidProduct;
  name: string;
  summary: string;
  prices: PlanPrices;
  includes: string[];
  notIncluded: string[];
};

export function pricingPlans(env?: RateEnv): PricingPlan[] {
  return [
    {
      product: "featured",
      name: "Featured",
      summary: `A directory boost for ${FEATURED_DAYS} days. Separate from a shop.`,
      prices: planPriceLines("featured", env),
      includes: [
        `Stays raised in browse for ${FEATURED_DAYS} days`,
        "Applies to one listing you choose",
        `A new payment starts another ${FEATURED_DAYS} days from that payment`,
      ],
      notIncluded: [
        "Does not verify the listing",
        "Does not add a shop banner or raise the offering limit",
      ],
    },
    {
      product: "verified_pro",
      name: "Verified Pro",
      summary: `The paid Pro plan. Shown as ${PRO_PLAN_LABEL}. It is not a verification badge.`,
      prices: planPriceLines("verified_pro", env),
      includes: [
        `Up to ${PRO_OFFERING_CAP} active offerings, instead of ${FREE_OFFERING_CAP} on a free shop`,
        "A cover banner on the shop",
        "One shop video, up to 45 seconds, after an admin reviews it",
        `Labelled ${PRO_PLAN_LABEL} on the shop and on listings`,
      ],
      notIncluded: [
        "Does not mean the shop is verified",
        "Phone, Location, and Business verified stay an admin grant",
        "The green listing Verified badge stays an admin action",
      ],
    },
  ];
}

export function pricingRateNote(env?: RateEnv) {
  const usd = kesPerUsd(env);
  const gbp = kesPerGbp(env);
  return `Kenyan shilling prices are the Nairobi charge. Pound prices are the London charge from the same table checkout uses. US dollar amounts are approximate, at ${usd} shillings per dollar, so someone abroad can compare. That figure is FX_KES_PER_USD (default ${DEFAULT_KES_PER_USD}) and it is not a live rate or the amount you pay. If a pound price were ever missing, the page would show an approximate pound amount at ${gbp} shillings per pound (FX_KES_PER_GBP, default ${DEFAULT_KES_PER_GBP}).`;
}
