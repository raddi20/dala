import type { MetadataRoute } from "next";
import { CATEGORIES, categoryHref } from "@/lib/categories";
import { isPublicInfoPath, PUBLIC_INFO_PAGES, publicPagesUpdatedAt } from "@/lib/public-info";
import { absoluteUrl } from "@/lib/share-metadata";

/** Not listed in the sitemap. Robots also disallows these prefixes. */
export const PRIVATE_PREFIXES = [
  "/admin",
  "/account",
  "/api",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
] as const;

export function isPrivatePath(path: string) {
  const pathname = path.split("?")[0] ?? path;
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type DatedPath = { path: string; updatedAt?: Date };

function entry(origin: string, path: string, updatedAt?: Date, changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"], priority?: number): MetadataRoute.Sitemap[number] | null {
  if (isPrivatePath(path)) return null;
  return {
    url: absoluteUrl(origin, path),
    ...(updatedAt ? { lastModified: updatedAt } : {}),
    ...(changeFrequency ? { changeFrequency } : {}),
    ...(priority !== undefined ? { priority } : {}),
  };
}

export function staticPublicPaths(): DatedPath[] {
  const paths: DatedPath[] = [
    { path: "/" },
    { path: "/welcome" },
    { path: "/list" },
    { path: "/categories" },
    { path: "/occasions" },
    { path: "/pricing" },
    { path: "/video-policy" },
    ...PUBLIC_INFO_PAGES.map((page) => ({ path: page.path, updatedAt: publicPagesUpdatedAt() })),
    { path: "/listings" },
    { path: "/listings?type=business" },
    { path: "/listings?type=classifieds" },
    { path: "/listings?region=homeland" },
    { path: "/listings?region=diaspora" },
  ];
  for (const category of CATEGORIES) {
    paths.push({ path: categoryHref(category) });
  }
  return paths;
}

export function buildSitemap(input: {
  origin: string;
  shops: { slug: string; updatedAt: Date }[];
  listings: { id: string; updatedAt: Date }[];
  people: { id: string; updatedAt: Date }[];
  occasions?: { slug: string; updatedAt?: Date }[];
}): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [];
  const push = (item: MetadataRoute.Sitemap[number] | null) => {
    if (item) pages.push(item);
  };

  for (const path of staticPublicPaths()) {
    const info = isPublicInfoPath(path.path);
    const priority =
      path.path === "/"
        ? 1
        : path.path === "/categories" ||
            path.path === "/occasions" ||
            path.path === "/pricing" ||
            path.path === "/welcome" ||
            path.path === "/list"
          ? 0.8
          : info
            ? 0.5
            : 0.7;
    push(entry(input.origin, path.path, path.updatedAt, info ? "monthly" : "weekly", priority));
  }
  for (const shop of input.shops) {
    if (!shop.slug) continue;
    push(entry(input.origin, `/b/${encodeURIComponent(shop.slug)}`, shop.updatedAt, "weekly", 0.8));
  }
  for (const listing of input.listings) {
    if (!listing.id) continue;
    push(entry(input.origin, `/listings/${encodeURIComponent(listing.id)}`, listing.updatedAt, "weekly", 0.6));
  }
  for (const person of input.people) {
    if (!person.id) continue;
    push(entry(input.origin, `/people/${encodeURIComponent(person.id)}`, person.updatedAt, "monthly", 0.4));
  }
  for (const occasion of input.occasions ?? []) {
    if (!occasion.slug) continue;
    push(entry(input.origin, `/occasions/${encodeURIComponent(occasion.slug)}`, occasion.updatedAt, "weekly", 0.7));
  }
  return pages;
}

export function buildRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PREFIXES],
    },
    sitemap: absoluteUrl(origin, "/sitemap.xml"),
  };
}
