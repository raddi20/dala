/**
 * Display prices in the visitor's currency. Checkout still charges KES or GBP.
 * Rates come from the keyless Open Exchange Rate API (USD base) and are cached
 * for 24 hours. Configured shilling rates cover USD if that feed is down.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const OPEN_ER_API = "https://open.er-api.com/v6/latest/USD";

const CURRENCY_BY_COUNTRY: Record<string, string> = {};

function assign(currency: string, countries: string) {
  for (const code of countries.split(" ")) CURRENCY_BY_COUNTRY[code] = currency;
}

assign("EUR", "AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK AD MC SM VA");
assign("USD", "US EC SV PA PR GU VI AS MP TL FM MH PW");
assign("GBP", "GB GG IM JE");
assign("KES", "KE");
assign("UGX", "UG");
assign("TZS", "TZ");
assign("RWF", "RW");
assign("BIF", "BI");
assign("SSP", "SS");
assign("ETB", "ET");
assign("SOS", "SO");
assign("DJF", "DJ");
assign("ERN", "ER");
assign("CAD", "CA");
assign("AUD", "AU");
assign("NZD", "NZ");
assign("CHF", "CH LI");
assign("JPY", "JP");
assign("CNY", "CN");
assign("INR", "IN");
assign("ZAR", "ZA");
assign("NGN", "NG");
assign("GHS", "GH");
assign("EGP", "EG");
assign("MAD", "MA");
assign("AED", "AE");
assign("SAR", "SA");
assign("QAR", "QA");
assign("KWD", "KW");
assign("BHD", "BH");
assign("OMR", "OM");
assign("SEK", "SE");
assign("NOK", "NO");
assign("DKK", "DK");
assign("PLN", "PL");
assign("CZK", "CZ");
assign("HUF", "HU");
assign("RON", "RO");
assign("BGN", "BG");
assign("TRY", "TR");
assign("BRL", "BR");
assign("MXN", "MX");
assign("ARS", "AR");
assign("CLP", "CL");
assign("COP", "CO");
assign("PEN", "PE");
assign("KRW", "KR");
assign("SGD", "SG");
assign("HKD", "HK");
assign("TWD", "TW");
assign("THB", "TH");
assign("MYR", "MY");
assign("IDR", "ID");
assign("PHP", "PH");
assign("VND", "VN");
assign("PKR", "PK");
assign("BDT", "BD");
assign("LKR", "LK");
assign("NPR", "NP");

export function countryCode(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(value)) return null;
  return value;
}

/** ISO currency for a country header, or null when we should show the real charges. */
export function currencyForCountry(country: string | null | undefined): string | null {
  const code = countryCode(country);
  if (!code) return null;
  return CURRENCY_BY_COUNTRY[code] ?? null;
}

export function parseOpenErApi(body: unknown): Record<string, number> | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { result?: unknown; rates?: unknown };
  if (record.result !== "success" || !record.rates || typeof record.rates !== "object") return null;
  const rates: Record<string, number> = {};
  for (const [key, value] of Object.entries(record.rates as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) rates[key] = value;
  }
  if (!(rates.USD > 0)) return null;
  return rates;
}

type RateStore = { current: { at: number; rates: Record<string, number> } | null };
const memory: RateStore = { current: null };

type Fetcher = (url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** Successful responses only. A failed fetch does not refresh the 24h cache. */
export async function cachedUsdRates(options?: {
  now?: number;
  fetcher?: Fetcher;
  store?: RateStore;
  ttlMs?: number;
}): Promise<Record<string, number> | null> {
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? DAY_MS;
  const store = options?.store ?? memory;
  if (store.current && now - store.current.at < ttl) return store.current.rates;
  const fetcher = options?.fetcher ?? fetch;
  try {
    const response = await fetcher(OPEN_ER_API, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const parsed = parseOpenErApi(await response.json());
    if (!parsed) return null;
    store.current = { at: now, rates: parsed };
    return parsed;
  } catch {
    return null;
  }
}

export function needsLiveRates(country: string | null | undefined) {
  const currency = currencyForCountry(country);
  return Boolean(currency && currency !== "KES" && currency !== "GBP");
}

function grouped(amount: number) {
  return String(Math.max(1, Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `≈ $19`, `≈ €18`, or a short currency code when there is no familiar symbol. */
export function approxLabel(amount: number, currency: string) {
  const rounded = Math.max(1, Math.round(amount));
  if (currency === "USD") return `≈ $${rounded}`;
  if (currency === "EUR") return `≈ €${rounded}`;
  if (currency === "GBP") return `≈ £${rounded}`;
  if (currency === "KES") return `≈ KES ${grouped(rounded)}`;
  try {
    const formatted = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(rounded);
    return `≈ ${formatted}`;
  } catch {
    return `≈ ${grouped(rounded)} ${currency}`;
  }
}

export type Money = { amount: number; label: string };

export type VisitorPrice =
  | { kind: "exact"; label: string; caption: string }
  | { kind: "approx"; label: string; caption: string }
  | { kind: "charges"; kesLabel: string; gbpLabel: string; caption: string };

const EXACT_KES = "Shops in Kenya and East Africa. Checkout charges this in Kenyan shillings.";
const EXACT_GBP = "Diaspora shops. Checkout charges this in pounds.";
const APPROX =
  "Approximate, in your currency, for shops in Kenya and East Africa. Payment is charged in Kenyan shillings for those shops, or in pounds for Diaspora shops.";
const CHARGES =
  "Checkout charges Kenyan shillings for shops in Kenya and East Africa, and pounds for Diaspora shops.";

export function visitorPrice(input: {
  country: string | null | undefined;
  kes: Money;
  gbp: Money;
  rates: Record<string, number> | null;
  kesPerUsd: number;
}): VisitorPrice {
  const currency = currencyForCountry(input.country);
  if (currency === "KES") return { kind: "exact", label: input.kes.label, caption: EXACT_KES };
  if (currency === "GBP") return { kind: "exact", label: input.gbp.label, caption: EXACT_GBP };
  if (!currency) {
    return { kind: "charges", kesLabel: input.kes.label, gbpLabel: input.gbp.label, caption: CHARGES };
  }
  const local = convertKes(input.kes.amount, currency, input.rates, input.kesPerUsd);
  if (local == null) {
    return { kind: "charges", kesLabel: input.kes.label, gbpLabel: input.gbp.label, caption: CHARGES };
  }
  return { kind: "approx", label: approxLabel(local, currency), caption: APPROX };
}

function convertKes(
  amountKes: number,
  currency: string,
  rates: Record<string, number> | null,
  kesPerUsd: number,
) {
  const kesPerDollar = rates?.KES && rates.KES > 0 ? rates.KES : kesPerUsd;
  if (!(kesPerDollar > 0) || !(amountKes > 0)) return null;
  const dollars = amountKes / kesPerDollar;
  if (currency === "USD") return dollars;
  const perUsd = rates?.[currency];
  if (!(perUsd && perUsd > 0)) return null;
  return dollars * perUsd;
}

export type LocalFx = {
  currency: string | null;
  perUsd: number | null;
  kesPerUsd: number;
  gbpPerUsd: number | null;
};

/** Rates the promote form needs to put an approximate local figure beside the exact charge. */
export function localFx(input: {
  country: string | null | undefined;
  rates: Record<string, number> | null;
  kesPerUsd: number;
  kesPerGbp: number;
}): LocalFx {
  const currency = currencyForCountry(input.country);
  const kesPerDollar = input.rates?.KES && input.rates.KES > 0 ? input.rates.KES : input.kesPerUsd;
  const gbpPerUsd =
    input.rates?.GBP && input.rates.GBP > 0
      ? input.rates.GBP
      : input.kesPerGbp > 0 && kesPerDollar > 0
        ? kesPerDollar / input.kesPerGbp
        : null;
  if (!currency) return { currency: null, perUsd: null, kesPerUsd: kesPerDollar, gbpPerUsd };
  if (currency === "USD") return { currency, perUsd: 1, kesPerUsd: kesPerDollar, gbpPerUsd };
  if (currency === "KES") return { currency, perUsd: kesPerDollar, kesPerUsd: kesPerDollar, gbpPerUsd };
  if (currency === "GBP") return { currency, perUsd: gbpPerUsd, kesPerUsd: kesPerDollar, gbpPerUsd };
  const perUsd = input.rates?.[currency];
  return {
    currency,
    perUsd: perUsd && perUsd > 0 ? perUsd : null,
    kesPerUsd: kesPerDollar,
    gbpPerUsd,
  };
}

/** Approximate local figure, or null when the charge is already in that currency or rates are missing. */
export function approxBesideCharge(
  charge: { amount: number; currency: "KES" | "GBP" },
  fx: LocalFx,
): string | null {
  if (!fx.currency || fx.currency === charge.currency) return null;
  if (!(fx.perUsd && fx.perUsd > 0) || !(fx.kesPerUsd > 0)) return null;
  let dollars: number;
  if (charge.currency === "KES") dollars = charge.amount / fx.kesPerUsd;
  else {
    if (!(fx.gbpPerUsd && fx.gbpPerUsd > 0)) return null;
    dollars = charge.amount / fx.gbpPerUsd;
  }
  const local = fx.currency === "USD" ? dollars : dollars * fx.perUsd;
  if (!Number.isFinite(local) || local <= 0) return null;
  return approxLabel(local, fx.currency);
}
