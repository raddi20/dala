import "server-only";
import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { townPageForName, type CityPage } from "@/lib/seo";

/** Published shops with a branch in the town, or whose owner lists the town. */
export function townShopFilter(city: string) {
  return publicShopWhere({
    published: true,
    OR: [{ branches: { some: { town: city } } }, { user: { city } }],
  });
}

/**
 * Towns that have at least one public listing, published shop owner town, or shop branch.
 * Empty towns, including a written city page with nothing on it, stay out of this list
 * so the homepage, town links, and the sitemap do not send Google a thin page.
 */
export async function townPagesWithContent(): Promise<CityPage[]> {
  const [listingCities, branchTowns, shopCities] = await Promise.all([
    prisma.listing.findMany({ where: publicListingWhere({ hidden: false }), select: { city: true }, distinct: ["city"] }),
    prisma.shopBranch.findMany({
      where: { storefront: publicShopWhere({ published: true }) },
      select: { town: true },
      distinct: ["town"],
    }),
    prisma.storefront.findMany({
      where: publicShopWhere({ published: true }),
      select: { user: { select: { city: true } } },
    }),
  ]);
  const names = [
    ...listingCities.map((row) => row.city),
    ...branchTowns.map((row) => row.town),
    ...shopCities.map((row) => row.user.city),
  ];
  const pages = new Map<string, CityPage>();
  for (const name of names) {
    const page = townPageForName(name);
    if (page && !pages.has(page.slug)) pages.set(page.slug, page);
  }
  return [...pages.values()];
}

/** Published shops with a branch in the town, or whose owner lists the town. */
export async function shopsInTown(city: string, take = 12) {
  return prisma.storefront.findMany({
    where: townShopFilter(city),
    orderBy: { updatedAt: "desc" },
    take,
    select: { slug: true, user: { select: { name: true } } },
  });
}
