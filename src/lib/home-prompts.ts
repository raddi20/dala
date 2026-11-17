import { categoryHref } from "@/lib/categories";
import { canonicalCity } from "@/lib/constants";
import { parseNlQuery } from "@/lib/nl-query";

/** Shown in the ask field. Plain text, no typed animation. This query matches seeded catering in Nairobi. */
export const HOME_ASK_PLACEHOLDER = "catering for an ayie in Nairobi";

export type HomePrompt = { label: string; query: string };

/**
 * Used when the catalogue is empty, and as the queries the homepage test checks.
 * Each one matches at least one seeded listing: food, events, a fundi, and beauty, all in Nairobi.
 */
export const FALLBACK_HOME_PROMPTS: readonly HomePrompt[] = [
  { label: "Catering for an ayie in Nairobi", query: "catering for an ayie in Nairobi" },
  { label: "DJ for an ayie", query: "DJ for an ayie" },
  { label: "Fundi in Nairobi", query: "fundi in Nairobi" },
  { label: "Dowry ceremony catering", query: "dowry ceremony catering" },
  { label: "Beauty in Nairobi", query: "beauty in Nairobi" },
];

export const HOME_PROMPTS = FALLBACK_HOME_PROMPTS;

/** Eight ways into the directory. Labels are short; hrefs use the existing category names. */
export const HOME_CATEGORY_CHIPS = [
  { label: "All", href: "/listings" },
  { label: "Food", href: categoryHref("Food & restaurants") },
  { label: "Events", href: categoryHref("Events & entertainment") },
  { label: "Housing", href: categoryHref("Real estate / housing") },
  { label: "Fundis", href: categoryHref("Construction & trades") },
  { label: "Beauty", href: categoryHref("Beauty & personal care") },
  { label: "Transport", href: categoryHref("Transport & logistics") },
  { label: "Shops", href: "/shops" },
] as const;

export function homePromptHref(query: string) {
  return `/listings?${new URLSearchParams({ nl: query }).toString()}`;
}

export type ListingExampleRow = { category: string; city: string; type: string };

/** Same hard filters the browse page applies: town, category, and type. Hints do not drop rows. */
export function listingMatchesPrompt(query: string, row: ListingExampleRow): boolean {
  const parsed = parseNlQuery(query);
  if (parsed.city) {
    const town = canonicalCity(row.city) || row.city;
    if (town !== parsed.city) return false;
  }
  if (parsed.category && row.category !== parsed.category) return false;
  if (parsed.type && row.type !== parsed.type) return false;
  return true;
}

type WordSpec = { category: string; word: string; type?: string };

/** Words the sentence parser maps back to one category, so the chip cannot miss that category. */
const FILL_WORDS: WordSpec[] = [
  { category: "Beauty & personal care", word: "beauty" },
  { category: "Transport & logistics", word: "taxi" },
  { category: "Professional services", word: "accountant" },
  { category: "Auto & mechanics", word: "mechanic" },
  { category: "Education & tutoring", word: "tutor", type: "services" },
  { category: "Retail / shops", word: "mitumba" },
  { category: "Health & wellness", word: "clinic", type: "business" },
  { category: "Real estate / housing", word: "housing", type: "housing" },
  { category: "Faith & community orgs", word: "church", type: "business" },
  { category: "Food & restaurants", word: "catering" },
  { category: "Events & entertainment", word: "DJ" },
  { category: "Construction & trades", word: "fundi", type: "services" },
];

function uniqueTowns(rows: ListingExampleRow[]): string[] {
  const towns: string[] = [];
  for (const row of rows) {
    const town = canonicalCity(row.city) || row.city.trim();
    if (town && !towns.includes(town)) towns.push(town);
  }
  return towns;
}

function preferTown(towns: string[], preferred: string): string {
  return towns.find((town) => town === preferred) ?? towns[0] ?? "";
}

function capitalise(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Chips built from listings that are live now. A chip is kept only when the
 * sentence parser's town, category, and type match at least one of those rows.
 * Theme phrases (ayie, dowry catering, a fundi, a DJ) are preferred when they match.
 */
export function promptsFromListings(rows: ListingExampleRow[]): HomePrompt[] {
  if (rows.length === 0) return [...FALLBACK_HOME_PROMPTS];

  const chosen: HomePrompt[] = [];
  const usedCategories = new Set<string>();

  function take(query: string, label = query, markCategory = true) {
    if (chosen.length >= 5) return;
    if (chosen.some((item) => item.query.toLowerCase() === query.toLowerCase())) return;
    if (!rows.some((row) => listingMatchesPrompt(query, row))) return;
    chosen.push({ label, query });
    if (markCategory) {
      const category = parseNlQuery(query).category;
      if (category) usedCategories.add(category);
    }
  }

  const foodTown = preferTown(
    uniqueTowns(rows.filter((row) => row.category === "Food & restaurants")),
    "Kisumu",
  );
  if (foodTown) take(`catering for an ayie in ${foodTown}`, `Catering for an ayie in ${foodTown}`, false);
  take("DJ for an ayie", "DJ for an ayie", false);
  const fundiTown = preferTown(
    uniqueTowns(rows.filter((row) => row.category === "Construction & trades" && row.type === "services")),
    "Kisumu",
  );
  if (fundiTown) take(`fundi in ${fundiTown}`, `Fundi in ${fundiTown}`, false);
  take("Dowry ceremony catering", "Dowry ceremony catering", false);

  for (const spec of FILL_WORDS) {
    if (chosen.length >= 5) break;
    if (usedCategories.has(spec.category)) continue;
    const towns = uniqueTowns(
      rows.filter((row) => row.category === spec.category && (!spec.type || row.type === spec.type)),
    );
    const town = preferTown(towns, "Kisumu");
    if (!town) continue;
    take(`${spec.word} in ${town}`, `${capitalise(spec.word)} in ${town}`);
  }

  if (chosen.length > 0) return chosen;
  const matchingFallbacks = FALLBACK_HOME_PROMPTS.filter((prompt) =>
    rows.some((row) => listingMatchesPrompt(prompt.query, row)),
  );
  return matchingFallbacks.length > 0 ? [...matchingFallbacks] : [...FALLBACK_HOME_PROMPTS];
}
