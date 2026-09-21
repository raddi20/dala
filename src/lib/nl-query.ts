import { typeLabel, regionLabel } from "@/lib/constants";

export type NlParse = {
  city: string;
  region: string;
  category: string;
  type: string;
  verified: boolean;
  q: string;
  summary: string;
};

const CATEGORY_KEYS: { category: string; keys: string[] }[] = [
  { category: "Food & restaurants", keys: ["restaurants", "restaurant", "catering", "kitchen", "food", "cafe"] },
  { category: "Professional services", keys: ["solicitors", "solicitor", "advocates", "advocate", "lawyers", "lawyer", "accountants", "accountant", "accounting", "legal", "tax"] },
  { category: "Beauty & personal care", keys: ["braiding", "braids", "barber", "salon", "beauty", "hair"] },
  { category: "Construction & trades", keys: ["electrician", "plumber", "builder", "fundi", "construction"] },
  { category: "Transport & logistics", keys: ["driving lesson", "minicab", "matatu", "courier", "logistics", "driving", "taxi", "cab"] },
  { category: "Education & tutoring", keys: ["tutoring", "tutor", "school", "lesson"] },
  { category: "Events & entertainment", keys: ["wedding", "entertainment", "benga", "event", "dj"] },
  { category: "Real estate / housing", keys: ["real estate", "bedsitter", "bedsit", "apartment", "housing", "flat"] },
  { category: "Auto & mechanics", keys: ["mechanic", "garage", "toyota", "car"] },
  { category: "Faith & community orgs", keys: ["fellowship", "community", "church", "faith"] },
  { category: "Retail / shops", keys: ["mitumba", "grocer", "retail", "shop"] },
  { category: "Health & wellness", keys: ["wellness", "clinic", "herbal", "health", "doctor"] },
];

const PLACES: { term: string; city: string; region: string }[] = [
  { term: "nairobi", city: "Nairobi", region: "homeland" },
  { term: "kilimani", city: "Nairobi", region: "homeland" },
  { term: "eastleigh", city: "Nairobi", region: "homeland" },
  { term: "kariobangi", city: "Nairobi", region: "homeland" },
  { term: "westlands", city: "Nairobi", region: "homeland" },
  { term: "umoja", city: "Nairobi", region: "homeland" },
  { term: "kenya", city: "Nairobi", region: "homeland" },
  { term: "homeland", city: "Nairobi", region: "homeland" },
  { term: "london", city: "London", region: "diaspora" },
  { term: "peckham", city: "London", region: "diaspora" },
  { term: "tottenham", city: "London", region: "diaspora" },
  { term: "woolwich", city: "London", region: "diaspora" },
  { term: "thamesmead", city: "London", region: "diaspora" },
  { term: "edmonton", city: "London", region: "diaspora" },
  { term: "stratford", city: "London", region: "diaspora" },
  { term: "diaspora", city: "London", region: "diaspora" },
  { term: "britain", city: "London", region: "diaspora" },
  { term: "england", city: "London", region: "diaspora" },
  { term: "uk", city: "London", region: "diaspora" },
];

const STOP = new Set([
  "in", "the", "a", "an", "for", "near", "me", "find", "show", "with", "and", "or", "of", "to", "on",
  "please", "looking", "want", "needed", "some", "any", "around", "from", "at", "my", "i", "we", "is", "are",
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string, flags: string) {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?=[^a-z0-9]|$)`, flags);
}

function hasTerm(text: string, term: string) {
  return termPattern(term, "i").test(text);
}

function longestKey(text: string, keys: string[]) {
  let best = "";
  for (const key of keys) {
    if (key.length > best.length && hasTerm(text, key)) best = key;
  }
  return best;
}

function earliestPlace(text: string) {
  let best: { index: number; term: string; city: string; region: string } | null = null;
  for (const place of PLACES) {
    const match = termPattern(place.term, "i").exec(text);
    if (match && (best === null || match.index < best.index)) {
      best = { index: match.index, term: place.term, city: place.city, region: place.region };
    }
  }
  return best;
}

function detectType(text: string) {
  const groups: { type: string; keys: string[] }[] = [
    { type: "housing", keys: ["house share", "for rent", "to rent", "bedsitter", "bedsit", "apartments", "apartment", "housing", "flats", "flat", "rooms", "room"] },
    { type: "for_sale", keys: ["for sale", "selling"] },
    { type: "wanted", keys: ["looking for", "wanted"] },
    { type: "services", keys: ["driving lesson", "self-assessment", "tutoring", "electrician", "plumber", "lessons", "service", "fundi", "tutor"] },
    { type: "business", keys: ["restaurants", "restaurant", "business", "garages", "garage", "clinics", "clinic", "churches", "church", "salons", "salon", "shops", "shop"] },
  ];
  for (const group of groups) {
    const key = longestKey(text, group.keys);
    if (key) return { type: group.type, term: key };
  }
  return { type: "", term: "" };
}

function stripTerms(text: string, terms: string[]) {
  let next = text;
  for (const term of terms) {
    if (!term) continue;
    next = next.replace(termPattern(term, "gi"), " ");
  }
  return next;
}

export function parseNlQuery(input: string): NlParse {
  const text = input.trim().toLowerCase();
  const matched: string[] = [];
  const place = earliestPlace(text);
  const city = place?.city ?? "";
  const region = place?.region ?? "";
  if (place) matched.push(place.term);

  let category = "";
  let categoryKey = "";
  for (const item of CATEGORY_KEYS) {
    const key = longestKey(text, item.keys);
    if (key.length > categoryKey.length) {
      category = item.category;
      categoryKey = key;
    }
  }
  if (categoryKey) matched.push(categoryKey);

  const typeHit = detectType(text);
  if (typeHit.term) matched.push(typeHit.term);

  const verified = hasTerm(text, "verified") || hasTerm(text, "trusted");
  if (verified) matched.push(hasTerm(text, "verified") ? "verified" : "trusted");

  const filtersUsed = Boolean(city || region || category || typeHit.type || verified);
  let q = "";
  if (!filtersUsed) {
    q = input.trim();
  } else {
    const leftover = stripTerms(text, matched);
    q = leftover
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !STOP.has(token))
      .join(" ");
  }

  const parts: string[] = [];
  if (city) parts.push(city);
  if (region) parts.push(regionLabel(region));
  if (category) parts.push(category);
  if (typeHit.type) parts.push(typeLabel(typeHit.type));
  if (verified) parts.push("Verified only");
  if (q) parts.push(`Text "${q}"`);

  return {
    city,
    region,
    category,
    type: typeHit.type,
    verified,
    q,
    summary: parts.length > 0 ? parts.join(" · ") : "No filters detected. Searching the words you typed.",
  };
}
