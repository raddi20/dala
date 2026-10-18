/**
 * Browse place filters. A town link lights the matching Homeland or Diaspora chip.
 * An unknown or empty city stays unset so it does not pretend to be a region.
 */

import { canonicalCity, regionForCity } from "@/lib/constants";

export type BrowseRegion = "homeland" | "diaspora";

/** Map a stored city onto a region chip. Unknown or empty cities stay unset. */
export function browseRegionFromCity(city: string): BrowseRegion | "" {
  const name = canonicalCity(city);
  if (!name) return "";
  return regionForCity(name);
}

/** ?city=kisumu becomes Kisumu. An empty param keeps the sentence parser's town. A bad param clears it. */
export function chosenBrowseCity(param: string, parsed = ""): string {
  if (param.trim()) return canonicalCity(param);
  return canonicalCity(parsed);
}

/** An explicit ?region= wins. An old ?city= link counts only when region is absent. */
export function activeBrowseRegion(city: string, region: string): BrowseRegion | "" {
  if (region === "homeland" || region === "diaspora") return region;
  return browseRegionFromCity(city);
}

/**
 * Toggle a Homeland or Diaspora chip. Always drops ?city= so the next URL
 * uses the region filter, and clicking the already-active chip clears it.
 */
export function browseRegionChipHref(base: Record<string, string>, region: BrowseRegion, path = "/listings"): string {
  const next = { ...base };
  const active = activeBrowseRegion(next.city ?? "", next.region ?? "");
  delete next.city;
  if (active === region) delete next.region;
  else next.region = region;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
