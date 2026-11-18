import type { MetadataRoute } from "next";
import { categoryHref, isCategory } from "@/lib/categories";
import { isPublicDemoHidden } from "@/lib/demo-visibility";
import { townPageForName, type CityPage } from "@/lib/seo";
import { isPublicListing, isPublicShop } from "@/lib/visibility";

type DemoEnv = Record<string, string | undefined>;

/** Google's sitemap cap is 50,000 URLs. Split before a file gets near that. */
export const SITEMAP_URL_LIMIT = 10_000;

export const CRAWL_PAGE_SIZE = 24;

export const HUB_LINK_LIMIT = 8;

export type HubLink = { href: string; label: string };

export function hubIndexable(shopCount: number, listingCount: number) {
  return shopCount > 0 || listingCount > 0;
}

/** Empty hubs stay followable so a later link can be crawled, and stay out of the index. */
export function hubRobots(shopCount: number, listingCount: number): { index: boolean; follow: true } {
  return { index: hubIndexable(shopCount, listingCount), follow: true };
}

export function crawlPage(raw: string | undefined) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 1;
  return value;
}

export function pageWindow(total: number, requested: number, pageSize: number) {
  const size = Math.max(1, Math.trunc(pageSize));
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const page = Math.min(Math.max(Math.trunc(requested) || 1, 1), pageCount);
  return { page, pageCount, start: (page - 1) * size };
}

/** Page 1 is the bare path. Later pages add one query key. */
export function crawlPageHref(path: string, key: string, page: number) {
  if (page <= 1) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}${encodeURIComponent(key)}=${page}`;
}

export function chunkSitemap<T>(entries: readonly T[], limit = SITEMAP_URL_LIMIT): T[][] {
  const size = Math.max(1, Math.floor(limit));
  if (entries.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

export function topCounted<T extends { label: string; count: number }>(rows: readonly T[], limit: number): T[] {
  return [...rows]
    .filter((row) => row.count > 0 && row.label.trim())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, Math.trunc(limit)));
}

type Counted = { updatedAt: Date; listingCount: number; shopCount: number };

function touch(map: Map<string, Counted>, key: string, at: Date, listings: number, shops: number) {
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { updatedAt: at, listingCount: listings, shopCount: shops });
    return;
  }
  prev.listingCount += listings;
  prev.shopCount += shops;
  if (at > prev.updatedAt) prev.updatedAt = at;
}

export function indexableCategories(input: {
  listings: { category: string; updatedAt: Date }[];
  shops: { categories: string[]; updatedAt: Date }[];
}): { name: string; updatedAt: Date; listingCount: number; shopCount: number }[] {
  const rows = new Map<string, Counted>();
  for (const listing of input.listings) {
    if (!isCategory(listing.category)) continue;
    touch(rows, listing.category, listing.updatedAt, 1, 0);
  }
  for (const shop of input.shops) {
    const seen = new Set<string>();
    for (const name of shop.categories) {
      if (!isCategory(name) || seen.has(name)) continue;
      seen.add(name);
      touch(rows, name, shop.updatedAt, 0, 1);
    }
  }
  return [...rows.entries()]
    .filter(([, row]) => hubIndexable(row.shopCount, row.listingCount))
    .map(([name, row]) => ({ name, ...row }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function indexableTownPages(input: {
  listings: { city: string; updatedAt: Date }[];
  shops: { towns: string[]; updatedAt: Date }[];
}): { page: CityPage; updatedAt: Date; listingCount: number; shopCount: number }[] {
  const rows = new Map<string, Counted & { page: CityPage }>();
  const add = (city: string, at: Date, listings: number, shops: number) => {
    const page = townPageForName(city);
    if (!page) return;
    const prev = rows.get(page.slug);
    if (!prev) {
      rows.set(page.slug, { page, updatedAt: at, listingCount: listings, shopCount: shops });
      return;
    }
    prev.listingCount += listings;
    prev.shopCount += shops;
    if (at > prev.updatedAt) prev.updatedAt = at;
  };
  for (const listing of input.listings) add(listing.city, listing.updatedAt, 1, 0);
  for (const shop of input.shops) {
    const seen = new Set<string>();
    for (const town of shop.towns) {
      const page = townPageForName(town);
      if (!page || seen.has(page.slug)) continue;
      seen.add(page.slug);
      add(town, shop.updatedAt, 0, 1);
    }
  }
  return [...rows.values()]
    .filter((row) => hubIndexable(row.shopCount, row.listingCount))
    .sort((a, b) => a.page.city.localeCompare(b.page.city));
}

export function hubLinksFromCounts(input: {
  towns: { label: string; count: number; href: string }[];
  categories: { label: string; count: number }[];
  limit?: number;
}): { towns: HubLink[]; categories: HubLink[] } {
  const limit = input.limit ?? HUB_LINK_LIMIT;
  return {
    towns: topCounted(input.towns, limit).map((row) => ({ href: row.href, label: row.label })),
    categories: topCounted(
      input.categories.map((row) => ({ ...row, href: categoryHref(row.label) })),
      limit,
    ).map((row) => ({ href: categoryHref(row.label), label: row.label })),
  };
}

/**
 * Sitemap membership for a shop. Same rule as a public shop, plus the demo flag:
 * @dala.local stays out when HIDE_DEMO_SHOPS is on, and stays in when it is off.
 */
export function shouldListShop(
  shop: { published: boolean; hidden: boolean; ownerSuspended: boolean; ownerEmail: string | null },
  env?: DemoEnv,
) {
  return (
    isPublicShop({
      published: shop.published,
      hidden: shop.hidden,
      ownerSuspended: shop.ownerSuspended,
    }) && !isPublicDemoHidden(shop.ownerEmail, env)
  );
}

export function shouldListListing(
  listing: { hidden: boolean; ownerSuspended: boolean; ownerEmail: string | null },
  env?: DemoEnv,
) {
  return (
    isPublicListing({ hidden: listing.hidden, ownerSuspended: listing.ownerSuspended }) &&
    !isPublicDemoHidden(listing.ownerEmail, env)
  );
}

export function chunkLastModified(entries: readonly MetadataRoute.Sitemap[number][]) {
  let max: Date | undefined;
  for (const entry of entries) {
    if (!entry.lastModified) continue;
    const date = new Date(entry.lastModified);
    if (Number.isNaN(date.getTime())) continue;
    if (!max || date > max) max = date;
  }
  return max;
}
