import type { MetadataRoute } from "next";
import { hiddenDemoUserFilter, publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { buildSitemap } from "@/lib/sitemap-entries";
import { loadShopGraph } from "@/lib/crawl-data";
import { indexableCategories, indexableTownPages, shouldListListing, shouldListShop } from "@/lib/crawl-index";

/**
 * Public shops, public listings, and hubs that actually have some.
 * Demo rows follow HIDE_DEMO_SHOPS, the same filter search and the old sitemap used.
 * Empty town and category hubs are left out here and noindexed on the page.
 */
export async function collectSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const origin = await publicOrigin();
  const demoUser = hiddenDemoUserFilter();
  const [shopRows, listingRows, people, occasions, shops] = await Promise.all([
    prisma.storefront.findMany({
      where: publicShopWhere({ published: true }),
      select: {
        slug: true,
        updatedAt: true,
        published: true,
        hidden: true,
        user: { select: { email: true, suspended: true } },
      },
    }),
    prisma.listing.findMany({
      where: publicListingWhere({ hidden: false }),
      select: {
        id: true,
        updatedAt: true,
        hidden: true,
        city: true,
        category: true,
        owner: { select: { email: true, suspended: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        suspended: false,
        AND: [
          { listings: { some: { hidden: false } } },
          // A seller with a public shop is listed once, at /b/<slug>. Their profile page repeats it.
          { NOT: { storefront: { is: { published: true, hidden: false } } } },
          ...(demoUser ? [demoUser] : []),
        ],
      },
      select: { id: true, updatedAt: true },
    }),
    prisma.occasion.findMany({
      select: { slug: true, updatedAt: true },
    }),
    loadShopGraph(),
  ]);

  const listings = listingRows.filter((row) =>
    shouldListListing({
      hidden: row.hidden,
      ownerSuspended: row.owner.suspended,
      ownerEmail: row.owner.email,
    }),
  );
  const listedShops = shopRows.filter((row) =>
    shouldListShop({
      published: row.published,
      hidden: row.hidden,
      ownerSuspended: row.user.suspended,
      ownerEmail: row.user.email,
    }),
  );
  const categories = indexableCategories({
    listings: listings.map((row) => ({ category: row.category, updatedAt: row.updatedAt })),
    shops: shops.map((shop) => ({ categories: shop.categories, updatedAt: shop.updatedAt })),
  });
  const towns = indexableTownPages({
    listings: listings.map((row) => ({ city: row.city, updatedAt: row.updatedAt })),
    shops: shops.map((shop) => ({ towns: shop.towns, updatedAt: shop.updatedAt })),
  });

  return buildSitemap({
    origin,
    shops: listedShops.map((shop) => ({ slug: shop.slug, updatedAt: shop.updatedAt })),
    listings: listings.map((listing) => ({ id: listing.id, updatedAt: listing.updatedAt })),
    people,
    occasions,
    towns: towns.map((town) => ({ ...town.page, updatedAt: town.updatedAt })),
    categories: categories.map((category) => ({ name: category.name, updatedAt: category.updatedAt })),
  });
}
