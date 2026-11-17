/**
 * When a search matches nothing, widen it in a fixed order:
 * drop the town, then the category, then a "for sale" type.
 * If that still matches nothing, drop every remaining filter so the page is not blank.
 */

export type RelaxableFilters = {
  q?: string;
  words?: string[];
  hints?: string[];
  city?: string;
  region?: string;
  category?: string;
  type?: string;
  verified?: boolean;
  badge?: string;
  diaspora?: boolean;
  occasion?: string;
  page?: number;
};

export type RelaxStep = {
  filters: RelaxableFilters;
  dropped: Array<"town" | "category" | "for_sale">;
};

export function searchFallbackSteps(filters: RelaxableFilters): RelaxStep[] {
  const steps: RelaxStep[] = [{ filters: { ...filters }, dropped: [] }];
  let current: RelaxableFilters = { ...filters };
  const dropped: RelaxStep["dropped"] = [];

  if ((current.city ?? "").trim()) {
    current = { ...current, city: "" };
    dropped.push("town");
    steps.push({ filters: { ...current }, dropped: [...dropped] });
  }
  if ((current.category ?? "").trim()) {
    current = { ...current, category: "" };
    dropped.push("category");
    steps.push({ filters: { ...current }, dropped: [...dropped] });
  }
  if (current.type === "for_sale") {
    current = { ...current, type: "" };
    dropped.push("for_sale");
    steps.push({ filters: { ...current }, dropped: [...dropped] });
  }
  return steps;
}

export function broadenedFilters(): RelaxableFilters {
  return {
    q: "",
    words: [],
    hints: [],
    city: "",
    region: "",
    category: "",
    type: "",
    verified: false,
    badge: "",
    diaspora: false,
    occasion: "",
    page: 1,
  };
}

export function fallbackNote(town: string): string {
  const place = town.trim();
  if (place) return `No exact matches in ${place}, here's what's close`;
  return "No exact matches, here's what's close";
}

function hasRestriction(filters: RelaxableFilters): boolean {
  return Boolean(
    (filters.q ?? "").trim() ||
      (filters.words && filters.words.length > 0) ||
      (filters.city ?? "").trim() ||
      (filters.region ?? "").trim() ||
      (filters.category ?? "").trim() ||
      (filters.type ?? "").trim() ||
      filters.verified ||
      (filters.badge ?? "").trim() ||
      filters.diaspora ||
      (filters.occasion ?? "").trim(),
  );
}

export async function searchWithFallback<T extends { total: number }>(
  filters: RelaxableFilters,
  search: (filters: RelaxableFilters) => Promise<T>,
): Promise<{ result: T; note: string; widened: boolean; droppedWords: boolean }> {
  const steps = searchFallbackSteps(filters);
  const town = (filters.city ?? "").trim();
  let droppedWords = false;
  let result = await search(steps[0].filters);
  if (result.total === 0 && (filters.words?.length ?? 0) > 0) {
    result = await search({ ...steps[0].filters, words: [] });
    droppedWords = true;
  }
  if (result.total > 0) return { result, note: "", widened: false, droppedWords };

  for (const step of steps.slice(1)) {
    result = await search({ ...step.filters, words: [], page: 1 });
    if (result.total > 0) return { result, note: fallbackNote(town), widened: true, droppedWords };
  }

  if (hasRestriction(filters)) {
    result = await search(broadenedFilters());
    if (result.total > 0) return { result, note: fallbackNote(town), widened: true, droppedWords };
  }
  return { result, note: "", widened: false, droppedWords };
}
