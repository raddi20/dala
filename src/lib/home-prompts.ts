import { categoryHref } from "@/lib/categories";

/** Shown in the ask field. Plain text, no typed animation. */
export const HOME_ASK_PLACEHOLDER = "catering for an ayie in Kisumu for 200";

export const HOME_PROMPTS = [
  { label: "Catering for an ayie in Kisumu for 200", query: "catering for an ayie in Kisumu for 200" },
  { label: "Fresh tilapia in Nairobi", query: "fresh tilapia in Nairobi" },
  { label: "DJ for an ayie", query: "DJ for an ayie" },
  { label: "Find a fundi in Kisumu", query: "find a fundi in Kisumu" },
  { label: "Dowry ceremony catering", query: "dowry ceremony catering" },
] as const;

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
