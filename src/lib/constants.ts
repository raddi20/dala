export const CATEGORIES = [
  "Food & restaurants",
  "Professional services",
  "Beauty & personal care",
  "Construction & trades",
  "Transport & logistics",
  "Education & tutoring",
  "Events & entertainment",
  "Real estate / housing",
  "Auto & mechanics",
  "Faith & community orgs",
  "Retail / shops",
  "Health & wellness",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LISTING_TYPES = [
  { value: "business", label: "Business", blurb: "A shop, practice, or organisation" },
  { value: "for_sale", label: "For sale", blurb: "An item you are selling" },
  { value: "wanted", label: "Wanted", blurb: "Something you are looking for" },
  { value: "housing", label: "Housing", blurb: "A room, flat, or house" },
  { value: "services", label: "Services", blurb: "A one-off or freelance service" },
] as const;

export type ListingType = (typeof LISTING_TYPES)[number]["value"];

export const CITIES = [
  { name: "Nairobi", region: "homeland", country: "Kenya" },
  { name: "London", region: "diaspora", country: "United Kingdom" },
] as const;

export type CityName = (typeof CITIES)[number]["name"];
export type RegionName = (typeof CITIES)[number]["region"];

export const REPORT_REASONS = [
  "Scam or fraud",
  "Spam",
  "Wrong information",
  "Harassment",
  "Other",
] as const;

export const FEATURED_DAYS = 30;

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
  const match = CITIES.find((item) => item.name === city);
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

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isListingType(value: string): value is ListingType {
  return LISTING_TYPES.some((item) => item.value === value);
}
