export { CATEGORIES, isCategory, type Category } from "@/lib/categories";

export const LISTING_TYPES = [
  { value: "business", label: "Business", blurb: "A shop, practice, or organisation" },
  { value: "for_sale", label: "For sale", blurb: "An item you are selling" },
  { value: "wanted", label: "Wanted", blurb: "Something you are looking for" },
  { value: "housing", label: "Housing", blurb: "A room, flat, or house" },
  { value: "services", label: "Services", blurb: "A one-off or freelance service" },
] as const;

export type ListingType = (typeof LISTING_TYPES)[number]["value"];

export const CITIES = [
  { name: "Kisumu", region: "homeland", country: "Kenya" },
  { name: "Homa Bay", region: "homeland", country: "Kenya" },
  { name: "Siaya", region: "homeland", country: "Kenya" },
  { name: "Migori", region: "homeland", country: "Kenya" },
  { name: "Kisii", region: "homeland", country: "Kenya" },
  { name: "Bondo", region: "homeland", country: "Kenya" },
  { name: "Kendu Bay", region: "homeland", country: "Kenya" },
  { name: "Mbita", region: "homeland", country: "Kenya" },
  { name: "Nakuru", region: "homeland", country: "Kenya" },
  { name: "Eldoret", region: "homeland", country: "Kenya" },
  { name: "Mombasa", region: "homeland", country: "Kenya" },
  { name: "Nairobi", region: "homeland", country: "Kenya" },
  { name: "London", region: "diaspora", country: "United Kingdom" },
] as const;

export type CityName = (typeof CITIES)[number]["name"];
export type RegionName = (typeof CITIES)[number]["region"];

/** Spellings that are not the catalogue name. "kenya" and "homeland" stay out of this map. */
const EXTRA_CITY_ALIASES: Record<string, CityName> = {
  "kisumu city": "Kisumu",
  kendu: "Kendu Bay",
};

function cityLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

const CITY_BY_KEY = new Map<string, CityName>();
for (const city of CITIES) {
  const spaced = cityLookupKey(city.name);
  CITY_BY_KEY.set(spaced, city.name);
  CITY_BY_KEY.set(city.name.toLowerCase().replace(/[\s_-]+/g, ""), city.name);
  if (spaced.includes(" ")) CITY_BY_KEY.set(spaced.replace(/ /g, "-"), city.name);
}
for (const [alias, name] of Object.entries(EXTRA_CITY_ALIASES)) {
  CITY_BY_KEY.set(cityLookupKey(alias), name);
  CITY_BY_KEY.set(alias.toLowerCase().replace(/[\s_-]+/g, ""), name);
}

/** Catalogue name for a town, or "" when the text is not one. Case and hyphens do not matter. */
export function canonicalCity(value: string): CityName | "" {
  const key = cityLookupKey(value);
  if (!key) return "";
  return CITY_BY_KEY.get(key) ?? CITY_BY_KEY.get(key.replace(/\s+/g, "")) ?? "";
}

/** Every accepted spelling, longest phrases included, for the sentence parser. */
export function cityAliasTerms(): { term: string; city: CityName; region: RegionName }[] {
  const regionByName = new Map(CITIES.map((city) => [city.name, city.region]));
  return [...CITY_BY_KEY.entries()].map(([term, city]) => ({
    term,
    city,
    region: regionByName.get(city) ?? "homeland",
  }));
}

/**
 * Register stores one city. Diaspora ignores the optional town.
 * A blank town on Kenya / East Africa stays Nairobi, so the account still sits under Homeland.
 */
export function registerCity(regionChoice: string, town: string): string {
  const choice = canonicalCity(regionChoice);
  if (!choice) return regionChoice.trim();
  if (regionForCity(choice) === "diaspora") return choice;
  const picked = canonicalCity(town);
  if (picked && regionForCity(picked) === "homeland") return picked;
  if (choice !== "Nairobi") return choice;
  return "Nairobi";
}

export const REPORT_REASONS = [
  "Scam or fraud",
  "Spam",
  "Wrong information",
  "Harassment",
  "Other",
] as const;

export const FEATURED_DAYS = 30;

/** How long one Verified Pro payment lasts. Renewing early adds this onto the current end date. */
export const PRO_DAYS = 30;

/** Active (not archived) offerings on a free shop. */
export const FREE_OFFERING_CAP = 5;

/** Active offerings once the seller has Verified Pro. */
export const PRO_OFFERING_CAP = 20;

export const OFFERING_CURRENCIES = ["KES", "GBP"] as const;

export type OfferingCurrency = (typeof OFFERING_CURRENCIES)[number];

export function offeringCap(verifiedPro: boolean) {
  return verifiedPro ? PRO_OFFERING_CAP : FREE_OFFERING_CAP;
}

export function isOfferingCurrency(value: string): value is OfferingCurrency {
  return (OFFERING_CURRENCIES as readonly string[]).includes(value);
}

/** Charged in major units. Nairobi is Kenyan shillings. London is pounds. */
export const CHARGE = {
  featured: {
    Nairobi: { amount: 1500, currency: "KES", label: "KES 1,500" },
    London: { amount: 12, currency: "GBP", label: "£12" },
  },
  verified_pro: {
    Nairobi: { amount: 2500, currency: "KES", label: "KES 2,500" },
    London: { amount: 20, currency: "GBP", label: "£20" },
  },
} as const;

export type PaidProduct = keyof typeof CHARGE;

export const PRICES = {
  featured: { Nairobi: CHARGE.featured.Nairobi.label, London: CHARGE.featured.London.label },
  verified_pro: {
    Nairobi: CHARGE.verified_pro.Nairobi.label,
    London: CHARGE.verified_pro.London.label,
  },
} as const;

export function isPaidProduct(value: string): value is PaidProduct {
  return value === "featured" || value === "verified_pro";
}

export function regionForCity(city: string): RegionName {
  const name = canonicalCity(city) || city;
  const match = CITIES.find((item) => item.name === name);
  return match?.region ?? "homeland";
}

export function typeLabel(value: string) {
  return LISTING_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function regionLabel(region: string) {
  if (region === "homeland") return "Homeland";
  if (region === "diaspora") return "Diaspora";
  return region;
}

/**
 * Region choice on the register form.
 * Nairobi means Kenya / East Africa. London means the Diaspora. Other towns use their names.
 */
export function cityChoiceLabel(city: string) {
  if (city === "London") return "Diaspora";
  if (city === "Nairobi") return "Kenya / East Africa";
  return city;
}

/** Short place on shop and listing chips. Nairobi and London keep the region words. */
export function cityChipLabel(city: string) {
  if (city === "London") return "Diaspora";
  if (city === "Nairobi") return "Kenya";
  return city;
}

/** Sentence fragment: "in Kenya and East Africa" or "in the Diaspora". */
export function cityInPhrase(city: string) {
  if (city === "London") return "in the Diaspora";
  if (city === "Nairobi") return "in Kenya and East Africa";
  return `in ${city}`;
}

export function chargeFor(product: PaidProduct, city: string) {
  const prices = CHARGE[product];
  return city === "London" ? prices.London : prices.Nairobi;
}

export function priceFor(product: PaidProduct, city: string) {
  return chargeFor(product, city).label;
}

export function productLabel(product: string) {
  if (product === "featured") return "Featured listing";
  if (product === "verified_pro") return "Verified Pro";
  return product;
}

export function isCityName(value: string): value is CityName {
  return CITIES.some((city) => city.name === value);
}

export function isListingType(value: string): value is ListingType {
  return LISTING_TYPES.some((item) => item.value === value);
}
