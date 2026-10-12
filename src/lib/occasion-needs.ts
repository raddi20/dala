import { categoryHref } from "@/lib/categories";

export type OccasionNeed = {
  label: string;
  href: string;
};

export type OccasionNeedBand = {
  heading: string;
  items: OccasionNeed[];
};

export const AYIE_NEEDS_HEADING = "Planning an ayie? Families also need";

const AYIE_NEEDS: OccasionNeed[] = [
  { label: "Tents & chairs", href: categoryHref("Tents, chairs & décor") },
  { label: "PA", href: categoryHref("Music & DJs") },
  { label: "Transport", href: categoryHref("Transport & logistics") },
  { label: "Fish", href: `/listings?nl=${encodeURIComponent("fresh tilapia")}` },
];

/**
 * A short suggestion row for one occasion.
 * Only ayie (weddings and dowry) has a band. Other slugs, including ones that
 * stay in the database, return nothing so this UI never names them.
 */
export function familiesAlsoNeed(slug: string): OccasionNeedBand | null {
  if (slug !== "weddings-dowry") return null;
  return { heading: AYIE_NEEDS_HEADING, items: AYIE_NEEDS };
}
