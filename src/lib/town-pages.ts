import "server-only";
import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { CITY_PAGES, townPageForName, type CityPage } from "@/lib/seo";

/**
 * Towns that have at least one public listing, published shop owner town, or shop branch.
 * These get a /places/<slug> page in the sitemap and in town links. Empty towns stay out,
 * so Google is not sent thin pages. The three written city pages are always included.
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
  const pages = new Map<string, CityPage>(CITY_PAGES.map((page) => [page.slug, page]));
  for (const name of names) {
    const page = townPageForName(name);
    if (page && !pages.has(page.slug)) pages.set(page.slug, page);
  }
  return [...pages.values()];
}

/** Published shops with a branch in the town, or whose owner lists the town. */
export async function shopsInTown(city: string, take = 12) {
  return prisma.storefront.findMany({
    where: publicShopWhere({
      published: true,
      OR: [{ branches: { some: { town: city } } }, { user: { city } }],
    }),
    orderBy: { updatedAt: "desc" },
    take,
    select: { slug: true, user: { select: { name: true } } },
  });
}
