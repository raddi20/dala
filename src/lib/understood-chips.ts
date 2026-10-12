import { regionLabel, typeLabel, cityChipLabel } from "@/lib/constants";
import { occasionDefinition } from "@/lib/occasions";

export type UnderstoodChip = {
  key: string;
  label: string;
  href: string;
};

/** Shown when a sentence search had leftover words that matched nothing. */
export const DROPPED_WORDS_NOTE =
  "Some of those words were not in any listing, so Rangach left them out and kept the rest of the search.";

const FILTER_KEYS = ["city", "region", "category", "type", "verified", "badge", "diaspora", "occasion", "q"] as const;

export function browseHref(path: string, filters: Record<string, string>, page = 0): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function chipBag(filters: {
  q?: string;
  city?: string;
  region?: string;
  category?: string;
  type?: string;
  verified?: boolean;
  badge?: string;
  diaspora?: boolean;
  occasion?: string;
  nl?: string;
}): Record<string, string> {
  return {
    q: filters.q ?? "",
    nl: filters.nl ?? "",
    city: filters.city ?? "",
    region: filters.region ?? "",
    category: filters.category ?? "",
    type: filters.type ?? "",
    verified: filters.verified ? "1" : "",
    badge: filters.badge ?? "",
    diaspora: filters.diaspora ? "1" : "",
    occasion: filters.occasion ?? "",
  };
}

export function toggleFilterHref(path: string, base: Record<string, string>, key: string, value: string): string {
  const next = { ...base };
  if (!value || next[key] === value) delete next[key];
  else next[key] = value;
  return browseHref(path, next);
}

function chipLabel(key: string, value: string): string {
  if (key === "city") return cityChipLabel(value) || value;
  if (key === "region") return regionLabel(value);
  if (key === "type") return value === "business" ? "Shops" : typeLabel(value);
  if (key === "verified") return "Checked";
  if (key === "diaspora") return "Family orders";
  if (key === "occasion") return occasionDefinition(value)?.title ?? value;
  if (key === "q") return `“${value}”`;
  return value;
}

/**
 * Removable chips for the filters a sentence search applied.
 * The href drops that filter and drops `nl`, so the sentence cannot put it back.
 */
export function understoodChips(path: string, filters: Record<string, string>, hints: string[] = []): UnderstoodChip[] {
  const chips: UnderstoodChip[] = [];
  for (const key of FILTER_KEYS) {
    const value = filters[key] ?? "";
    if (!value) continue;
    const next = { ...filters };
    delete next[key];
    delete next.nl;
    chips.push({ key, label: chipLabel(key, value), href: browseHref(path, next) });
  }
  const words = hints.map((hint) => hint.trim()).filter(Boolean);
  if (words.length > 0) {
    const next = { ...filters };
    delete next.nl;
    chips.push({ key: "hints", label: words.join(" "), href: browseHref(path, next) });
  }
  return chips;
}

export function matchCountLabel(total: number, page: number, pageSize: number): string {
  if (total === 0) return "0 matches";
  const noun = total === 1 ? "match" : "matches";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  if (start <= 1 && end >= total) return `${total} ${noun}`;
  return `${start}–${end} of ${total} matches`;
}
