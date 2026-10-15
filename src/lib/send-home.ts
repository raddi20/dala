import { isPlausibleEmail, normalizeEmail } from "@/lib/admin-access";
import { kesPerGbp, kesPerUsd } from "@/lib/pricing-display";
import { parsePhone } from "@/lib/phone";
import { visitorPrice } from "@/lib/visitor-currency";

export const SEND_HOME_PATH = "/send-home";

export const SEND_HOME_THANKS =
  "Thanks. We'll email you when a send-home basket is open. We are not taking card orders.";

export const SEND_HOME_LIMIT_MESSAGE =
  "Too many waitlist sign-ups from this connection. Wait an hour and try again.";

export const SEND_HOME_WAITLIST_NOTE =
  "This is a waitlist. We are not taking card orders, and the shop is paid directly when that starts. Rangach does not hold the money.";

export const SEND_HOME_COUNTRIES = [
  { id: "gb", label: "United Kingdom" },
  { id: "us", label: "United States" },
  { id: "ca", label: "Canada" },
  { id: "ae", label: "United Arab Emirates" },
  { id: "de", label: "Germany" },
  { id: "other", label: "Other" },
] as const;

export const SEND_HOME_AREAS = [
  { id: "kisumu", label: "Kisumu" },
  { id: "siaya", label: "Siaya" },
  { id: "homa-bay", label: "Homa Bay" },
  { id: "migori", label: "Migori" },
  { id: "other", label: "Other" },
] as const;

export type SendHomeBasket = {
  id: string;
  name: string;
  kes: number | null;
};

export const SEND_HOME_BASKETS: readonly SendHomeBasket[] = [
  { id: "grocery-3000", name: "Grocery basket", kes: 3000 },
  { id: "grocery-5000", name: "Grocery basket", kes: 5000 },
  { id: "grocery-10000", name: "Grocery basket", kes: 10000 },
  { id: "tilapia", name: "Fresh tilapia", kes: null },
  { id: "ayie", name: "Dowry ceremony catering", kes: null },
  { id: "fundi", name: "A fundi in Kisumu", kes: null },
];

const BASKET_IDS = new Set(SEND_HOME_BASKETS.map((basket) => basket.id));

function group(amount: number) {
  return String(Math.max(0, Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function basketPriceLabel(
  basket: SendHomeBasket,
  input: {
    country: string | null | undefined;
    rates: Record<string, number> | null;
    kesPerUsd?: number;
    kesPerGbp?: number;
  },
) {
  if (!basket.kes) return basket.name;
  const perGbp = input.kesPerGbp && input.kesPerGbp > 0 ? input.kesPerGbp : kesPerGbp();
  const perUsd = input.kesPerUsd && input.kesPerUsd > 0 ? input.kesPerUsd : kesPerUsd();
  const pounds = Math.max(1, Math.round(basket.kes / perGbp));
  const shown = visitorPrice({
    country: input.country,
    kes: { amount: basket.kes, label: `KES ${group(basket.kes)}` },
    gbp: { amount: pounds, label: `£${group(pounds)}` },
    rates: input.rates,
    kesPerUsd: perUsd,
  });
  const price = shown.kind === "charges" ? shown.kesLabel : shown.label;
  return `${basket.name} · ${price}`;
}

export type WaitlistFields = {
  name: string;
  email: string;
  country: string;
  countryOther: string;
  homeArea: string;
  homeAreaOther: string;
  baskets: string[];
  whatsapp: string;
  consent: string;
};

export type WaitlistDraft = {
  name: string;
  email: string;
  country: string;
  homeArea: string;
  baskets: string;
  whatsapp: string;
  consentAt: Date;
};

function cleanLine(raw: string, min: number, max: number) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < min || value.length > max) return null;
  return value;
}

function choiceLabel(
  raw: string,
  other: string,
  options: readonly { id: string; label: string }[],
): string | null {
  const id = raw.trim().toLowerCase();
  const known = options.find((option) => option.id === id);
  if (!known) return null;
  if (known.id !== "other") return known.label;
  return cleanLine(other, 2, 60);
}

export function parseWaitlist(
  fields: WaitlistFields,
  now = new Date(),
): { ok: true; draft: WaitlistDraft } | { ok: false; error: string; field: string } {
  if (fields.consent.trim() !== "1") {
    return { ok: false, error: "Tick the box to agree before we keep your details.", field: "consent" };
  }
  const name = cleanLine(fields.name, 2, 80);
  if (!name) return { ok: false, error: "Enter your name.", field: "name" };
  const email = normalizeEmail(fields.email);
  if (!isPlausibleEmail(email)) return { ok: false, error: "Enter an email address.", field: "email" };
  const country = choiceLabel(fields.country, fields.countryOther, SEND_HOME_COUNTRIES);
  if (!country) return { ok: false, error: "Choose a country.", field: "country" };
  const homeArea = choiceLabel(fields.homeArea, fields.homeAreaOther, SEND_HOME_AREAS);
  if (!homeArea) return { ok: false, error: "Choose a home area.", field: "homeArea" };
  const baskets = [...new Set(fields.baskets.map((item) => item.trim()).filter((item) => BASKET_IDS.has(item)))];
  if (baskets.length === 0) return { ok: false, error: "Choose at least one basket.", field: "baskets" };
  const whatsappRaw = fields.whatsapp.trim();
  let whatsapp = "";
  if (whatsappRaw) {
    const phone = parsePhone(whatsappRaw, "KE");
    if (!phone.ok) return { ok: false, error: phone.error, field: "whatsapp" };
    whatsapp = phone.e164;
  }
  return {
    ok: true,
    draft: {
      name,
      email,
      country,
      homeArea,
      baskets: baskets.join(","),
      whatsapp,
      consentAt: now,
    },
  };
}

export async function takeWaitlist(input: {
  fields: WaitlistFields;
  ip: string;
  now?: Date;
  limit: (ip: string) => Promise<boolean>;
  create: (draft: WaitlistDraft) => Promise<void>;
}): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  if (await input.limit(input.ip || "unknown")) return { ok: false, error: SEND_HOME_LIMIT_MESSAGE };
  const parsed = parseWaitlist(input.fields, input.now);
  if (!parsed.ok) return parsed;
  await input.create(parsed.draft);
  return { ok: true };
}

export function countLabels(rows: { label: string }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = row.label.trim() || "none";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type PilotShop = { id: string; sendHomePilot: boolean; slug: string; userId: string };

export async function savePilotFlag(input: {
  id: string;
  on: boolean;
  find: (id: string) => Promise<PilotShop | null>;
  update: (id: string, on: boolean) => Promise<void>;
  audit: (entry: { action: string; targetType: string; targetId: string; reason: string }) => Promise<void>;
}): Promise<{ ok: true; changed: boolean } | { ok: false; code: "missing" }> {
  const shop = await input.find(input.id);
  if (!shop) return { ok: false, code: "missing" };
  if (shop.sendHomePilot === input.on) return { ok: true, changed: false };
  await input.update(shop.id, input.on);
  await input.audit({
    action: input.on ? "shop.send_home_on" : "shop.send_home_off",
    targetType: "storefront",
    targetId: shop.id,
    reason: input.on ? "Show this shop on the send-home page." : "Hide this shop from the send-home page.",
  });
  return { ok: true, changed: true };
}

export function isListedPilot(shop: {
  sendHomePilot: boolean;
  published: boolean;
  hidden: boolean;
  ownerSuspended: boolean;
}) {
  return shop.sendHomePilot && shop.published && !shop.hidden && !shop.ownerSuspended;
}

export const WAITLIST_CSV_COLUMNS = [
  "id",
  "createdAt",
  "name",
  "email",
  "country",
  "homeArea",
  "baskets",
  "whatsapp",
  "consentAt",
] as const;

export type WaitlistCsvRow = {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  country: string;
  homeArea: string;
  baskets: string;
  whatsapp: string;
  consentAt: Date;
};

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function waitlistCsv(rows: WaitlistCsvRow[]) {
  const lines = [WAITLIST_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.createdAt.toISOString(),
        row.name,
        row.email,
        row.country,
        row.homeArea,
        row.baskets,
        row.whatsapp,
        row.consentAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
