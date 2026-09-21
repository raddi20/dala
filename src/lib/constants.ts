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

export const PRICES = {
  featured: { Nairobi: "KES 1,500", London: "£12" },
  verified_pro: { Nairobi: "KES 2,500", London: "£20" },
} as const;

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

export function priceFor(product: keyof typeof PRICES, city: string) {
  if (city === "London") return PRICES[product].London;
  return PRICES[product].Nairobi;
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
