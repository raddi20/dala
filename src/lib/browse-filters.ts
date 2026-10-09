/**
 * Browse place filters. Catalogue cities still exist as stored values and as
 * old ?city= links. The chips and the More filters menu offer Homeland or
 * Diaspora only, so a city link lights the matching region chip.
 */

export type BrowseRegion = "homeland" | "diaspora";

/** Map a stored city onto a region chip. Unknown or empty cities stay unset. */
export function browseRegionFromCity(city: string): BrowseRegion | "" {
  if (city === "Nairobi") return "homeland";
  if (city === "London") return "diaspora";
  return "";
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
export function browseRegionChipHref(base: Record<string, string>, region: BrowseRegion): string {
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
  return qs ? `/listings?${qs}` : "/listings";
}
