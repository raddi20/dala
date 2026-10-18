import { CATEGORIES } from "@/lib/categories";
import { canonicalCity, cityAliasTerms, regionForCity, regionLabel, typeLabel } from "@/lib/constants";

export type NlParse = {
  city: string;
  region: string;
  category: string;
  type: string;
  verified: boolean;
  /** Hard text filter. Empty for sentence search; leftovers are hints, not a required phrase. */
  q: string;
  /** Words that rank matches. They are not required, so they cannot zero a category or place. */
  hints: string[];
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

export const PLACES: { term: string; city: string; region: string }[] = [
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
  "someone", "somebody", "something", "mum", "mom", "next", "month", "week", "today", "tomorrow",
  "tonight", "yesterday", "soon", "weekend", "year", "just", "really",
]);

const OCCASION_TERMS = ["homecomings", "homecoming", "weddings", "wedding", "funerals", "funeral", "christmas", "dowry", "ayie"];

const CITY_TERMS = cityAliasTerms();

const TIME_PHRASES = ["next month", "next week", "next year", "this month", "this week", "this weekend", "this year"];

export function isHomelandTown(value: string): boolean {
  const city = canonicalCity(value);
  return Boolean(city) && regionForCity(city) === "homeland";
}

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

/** Same keyword map the sentence parser uses for a listing category. Longest key wins. */
export function categoryFromKeys(input: string): string {
  return bestCategoryKey(input.toLowerCase()).category;
}

/**
 * Categories a shop or offering belongs to.
 * The keyword map is the same one listings use. A catalogue name also matches
 * when that name appears as a word, so "catering" is Food & restaurants and Catering.
 */
export function categoriesInText(input: string): string[] {
  const text = input.toLowerCase();
  const found: string[] = [];
  const fromKeys = categoryFromKeys(text);
  if (fromKeys) found.push(fromKeys);
  const names = [...CATEGORIES].sort((left, right) => right.length - left.length);
  for (const name of names) {
    if (found.includes(name)) continue;
    if (hasTerm(text, name.toLowerCase())) found.push(name);
  }
  return found;
}

function bestCategoryKey(text: string): { category: string; key: string } {
  let category = "";
  let categoryKey = "";
  for (const item of CATEGORY_KEYS) {
    const key = longestKey(text, item.keys);
    if (key.length > categoryKey.length) {
      category = item.category;
      categoryKey = key;
    }
  }
  return { category, key: categoryKey };
}

/** A named town wins over a generic place such as "kenya" or "homeland", even when the generic word comes first. */
function earliestTown(text: string) {
  let best: { index: number; length: number; term: string; city: string; region: string } | null = null;
  for (const alias of CITY_TERMS) {
    const match = termPattern(alias.term, "i").exec(text);
    if (!match) continue;
    const length = alias.term.length;
    if (best === null || match.index < best.index || (match.index === best.index && length > best.length)) {
      best = { index: match.index, length, term: alias.term, city: alias.city, region: alias.region };
    }
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

function hintTokens(text: string, matched: string[]): string[] {
  const leftover = stripTerms(text, matched);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of leftover.split(/[^a-z0-9]+/)) {
    if (token.length <= 2 || STOP.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= 6) break;
  }
  return out;
}

export function parseNlQuery(input: string): NlParse {
  const text = input.trim().toLowerCase();
  const matched: string[] = [];
  const town = earliestTown(text);
  const place = town ? null : earliestPlace(text);
  const city = town?.city ?? place?.city ?? "";
  const region = town?.region ?? place?.region ?? "";
  if (town) matched.push(town.term);
  else if (place) matched.push(place.term);

  const categoryHit = bestCategoryKey(text);
  const category = categoryHit.category;
  if (categoryHit.key) matched.push(categoryHit.key);

  const typeHit = detectType(text);
  if (typeHit.term) matched.push(typeHit.term);

  const verified = hasTerm(text, "verified") || hasTerm(text, "trusted");
  if (verified) matched.push(hasTerm(text, "verified") ? "verified" : "trusted");

  for (const phrase of [...TIME_PHRASES, ...OCCASION_TERMS]) {
    if (hasTerm(text, phrase)) matched.push(phrase);
  }

  const hints = hintTokens(text, matched);
  const parts: string[] = [];
  if (city) parts.push(city);
  if (region) parts.push(regionLabel(region));
  if (category) parts.push(category);
  if (typeHit.type) parts.push(typeLabel(typeHit.type));
  if (verified) parts.push("Verified only");
  if (hints.length > 0) parts.push(`Ordering by “${hints.join(" ")}”`);

  return {
    city,
    region,
    category,
    type: typeHit.type,
    verified,
    q: "",
    hints,
    summary: parts.length > 0 ? parts.join(" · ") : "No filters detected.",
  };
}

export function rankByHints<T extends { title: string; description: string; address?: string }>(rows: T[], hints: string[]): T[] {
  if (hints.length === 0) return rows;
  return rows
    .map((row, index) => {
      const hay = `${row.title}\n${row.description}\n${row.address ?? ""}`.toLowerCase();
      const score = hints.reduce((sum, hint) => sum + (hay.includes(hint) ? 1 : 0), 0);
      return { row, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.row);
}
