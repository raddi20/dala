import { categoriesInText, categoryFromKeys } from "@/lib/nl-query";
import { isProActive, visibleOfferings, type ProFields } from "@/lib/pro";
import { pickPrimaryShopListing, type ShopListingSignal } from "@/lib/storefront";

export type CategoryListing = ShopListingSignal & { category: string };

export function publicOfferingSlice<T>(offerings: readonly T[], user: ProFields): T[] {
  return visibleOfferings(offerings, isProActive(user));
}

export function offeringIsPublic(offeringId: string, offerings: readonly { id: string }[], user: ProFields): boolean {
  return publicOfferingSlice(offerings, user).some((offering) => offering.id === offeringId);
}

export function shopSearchText(input: {
  name: string;
  bio: string;
  offerings: { title: string; description: string }[];
}): string {
  return [input.name, input.bio, ...input.offerings.flatMap((offering) => [offering.title, offering.description])]
    .filter(Boolean)
    .join("\n");
}

/** Listing categories, plus the same keyword and name map used for listing search. */
export function shopCategories(input: {
  name: string;
  bio: string;
  offerings: { title: string; description: string }[];
  listings: { category: string }[];
}): string[] {
  const found = new Set<string>();
  for (const listing of input.listings) {
    if (listing.category) found.add(listing.category);
  }
  for (const category of categoriesInText(shopSearchText(input))) found.add(category);
  return [...found];
}

export function displayShopCategory(input: {
  name: string;
  bio: string;
  offerings: { title: string; description: string }[];
  listings: CategoryListing[];
}): string {
  const primary = pickPrimaryShopListing(input.listings);
  if (primary?.category) return primary.category;
  const text = shopSearchText(input);
  return categoryFromKeys(text) || categoriesInText(text)[0] || "";
}

export function offeringCategories(title: string, description: string): string[] {
  return categoriesInText(`${title}\n${description}`);
}

export function displayOfferingCategory(title: string, description: string): string {
  const text = `${title}\n${description}`;
  return categoryFromKeys(text) || categoriesInText(text)[0] || "";
}

export function categoryCountLabel(listings: number, shops: number): string {
  const parts: string[] = [];
  if (listings > 0) parts.push(listings === 1 ? "1 listing" : `${listings} listings`);
  if (shops > 0) parts.push(shops === 1 ? "1 shop" : `${shops} shops`);
  return parts.length > 0 ? parts.join(", ") : "0 listings";
}
