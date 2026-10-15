import { visitorPrice } from "@/lib/visitor-currency";

export const BUSINESS_SIGNUP_PATH = "/business";
export const KISUMU_SHEET_PATH = "/business/kisumu";
/** Printed Kisumu sheet. The QR opens the sign-up with this ref. */
export const KISUMU_QR_REF = "kisumu-qr";

export const BUSINESS_PITCH =
  "Your customers already order on WhatsApp. Rangach gives you a proper shop page and basket, so they send you a clean order, pay your own till, and you deliver. That includes Luo diaspora customers buying for family at home. No 20% commission like the big apps, just a small monthly fee.";

export const BUSINESS_EXAMPLE =
  "A fundi in Kisumu, fresh tilapia, or dowry ceremony catering can start on Duka Starter.";

export const BUSINESS_ANNUAL =
  "An annual plan is two months free. No exclusivity. Cancel any time. Orders that go to your own till have no commission.";

export const BUSINESS_HAND_BILLING = "Billing is by hand. There is no card payment on this page.";

export const BUSINESS_OBJECTIONS = [
  {
    question: "I already use WhatsApp Business.",
    answer: "We keep WhatsApp. We add the catalogue, the basket, and buyers who find you on Rangach.",
  },
  {
    question: "Who holds my money?",
    answer: "You do. Payments go to your till or your own account. Rangach does not hold the money.",
  },
  {
    question: "Too expensive.",
    answer: "Starter is KES 1,500 a month, and the first month is free. One extra basket a week covers it.",
  },
  {
    question: "No time to upload products.",
    answer: "Send photos and a price list on WhatsApp. On Pro and above we can load them for you.",
  },
] as const;

export type BusinessTierId = "starter" | "pro" | "business";

export type BusinessTier = {
  id: BusinessTierId;
  name: string;
  kes: number;
  kesTo: number | null;
  period: string;
  offer: string;
  contactUs: boolean;
  includes: readonly string[];
};

export const BUSINESS_TIERS: readonly BusinessTier[] = [
  {
    id: "starter",
    name: "Duka Starter",
    kes: 1500,
    kesTo: null,
    period: "per month",
    offer: "First month free",
    contactUs: false,
    includes: [
      "A shop page",
      "Up to 100 products",
      "An order button that sends the basket on WhatsApp",
      "Your M-Pesa till on the shop",
      "Basic counts of views and taps",
    ],
  },
  {
    id: "pro",
    name: "Duka Pro",
    kes: 4500,
    kesTo: null,
    period: "per month",
    offer: "",
    contactUs: false,
    includes: [
      "Up to 1,000 products",
      "A price list and photos, uploaded for you on request",
      "A basket that sends a clean WhatsApp order",
      "Delivery options you set",
      "Featured placement in your town",
      "Diaspora baskets, when that service is on",
      "Protected Orders at 4%, when that service is on",
    ],
  },
  {
    id: "business",
    name: "Business",
    kes: 10000,
    kesTo: 15000,
    period: "per month",
    offer: "",
    contactUs: true,
    includes: [
      "2,000 products or more",
      "A price-list sync for a supermarket or wholesaler",
      "More than one person on the shop",
      "Priority placement",
      "A monthly report",
      "A visit to help you start",
    ],
  },
];

const TIER_IDS = new Set<string>(BUSINESS_TIERS.map((tier) => tier.id));

export function isBusinessTier(value: string): value is BusinessTierId {
  return TIER_IDS.has(value);
}

export function businessTierById(value: string): BusinessTier | null {
  const id = value.trim().toLowerCase();
  return BUSINESS_TIERS.find((tier) => tier.id === id) ?? null;
}

function group(amount: number) {
  return String(Math.max(0, Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function kesLabel(amount: number) {
  return `KES ${group(amount)}`;
}

export function tierOptionLabel(tier: BusinessTier) {
  if (tier.kesTo) return `${tier.name} · ${kesLabel(tier.kes)}–${group(tier.kesTo)}`;
  return `${tier.name} · ${kesLabel(tier.kes)} / month`;
}

export type TierPriceView = {
  primary: string;
  secondary: string | null;
  caption: string;
};

function joinMoney(low: string, high: string) {
  if (low.startsWith("≈ ") && high.startsWith("≈ ")) return `${low}–${high.slice(2)}`;
  if (low.startsWith("KES ") && high.startsWith("KES ")) return `${low}–${high.slice(4)}`;
  return `${low}–${high}`;
}

type PriceEnd = { kind: "exact" | "approx" | "charges"; text: string; alt: string | null };

function priceEnd(
  amount: number,
  input: {
    country: string | null | undefined;
    rates: Record<string, number> | null;
    kesPerUsd: number;
    kesPerGbp: number;
  },
): PriceEnd {
  const perGbp = input.kesPerGbp > 0 ? input.kesPerGbp : 170;
  const pounds = Math.max(1, Math.round(amount / perGbp));
  const shown = visitorPrice({
    country: input.country,
    kes: { amount, label: kesLabel(amount) },
    gbp: { amount: pounds, label: `£${group(pounds)}` },
    rates: input.rates,
    kesPerUsd: input.kesPerUsd > 0 ? input.kesPerUsd : 129,
  });
  if (shown.kind === "charges") return { kind: "charges", text: shown.kesLabel, alt: shown.gbpLabel };
  if (shown.kind === "approx") return { kind: "approx", text: shown.label, alt: null };
  return { kind: "exact", text: shown.label, alt: null };
}

function priceCaption(kind: PriceEnd["kind"], text: string) {
  if (kind === "charges") {
    return "Kenya and East Africa price, per month. The other figure is a Diaspora approximation.";
  }
  if (kind === "approx") return "Approximate, in your currency. We invoice Kenyan shillings.";
  if (text.startsWith("KES")) return "Per month, in Kenyan shillings.";
  return "Approximate monthly fee in pounds. We invoice Kenyan shillings.";
}

/** Visitor currency, using the same rate path as the pricing page. The invoice is still KES. */
export function tierPriceView(
  tier: BusinessTier,
  input: {
    country: string | null | undefined;
    rates: Record<string, number> | null;
    kesPerUsd: number;
    kesPerGbp: number;
  },
): TierPriceView {
  const low = priceEnd(tier.kes, input);
  const high = tier.kesTo ? priceEnd(tier.kesTo, input) : null;
  const primary = high ? joinMoney(low.text, high.text) : low.text;
  const secondary = low.kind === "charges" && low.alt ? (high?.alt ? joinMoney(low.alt, high.alt) : low.alt) : null;
  return { primary, secondary, caption: priceCaption(low.kind, low.text) };
}

export function businessSignupUrl(origin: string, ref = KISUMU_QR_REF) {
  const base = origin.replace(/\/$/, "");
  const params = new URLSearchParams();
  if (ref) params.set("ref", ref);
  const query = params.toString();
  return `${base}${BUSINESS_SIGNUP_PATH}${query ? `?${query}` : ""}`;
}
