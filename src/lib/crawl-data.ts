import "server-only";
import { isCategory } from "@/lib/categories";
import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { publicOfferingSlice, shopCategories } from "@/lib/shop-category";
import { pickPrimaryShopListing } from "@/lib/storefront";
import { cityPagePath, townPageForName } from "@/lib/seo";
import { selectRelatedListings } from "@/lib/related-listings";
import { CRAWL_PAGE_SIZE, HUB_LINK_LIMIT, hubLinksFromCounts, pageWindow, type HubLink } from "@/lib/crawl-index";
import { townShopFilter } from "@/lib/town-pages";

export type CrawlListingLink = { id: string; title: string; priceLabel: string };

const listingLinkSelect = { id: true, title: true, priceLabel: true } as const;

export async function shopCrawlFacts(ownerId: string) {
  const listings = await prisma.listing.findMany({
    where: publicListingWhere({ ownerId }),
    select: { category: true, type: true, verified: true, featured: true, featuredUntil: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    total: listings.length,
    category: pickPrimaryShopListing(listings)?.category ?? "",
  };
}

export async function shopListingPage(ownerId: string, requested: number) {
  const where = publicListingWhere({ ownerId });
  const total = await prisma.listing.count({ where });
  const window = pageWindow(total, requested, CRAWL_PAGE_SIZE);
  const listings = total
    ? await prisma.listing.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: window.start,
        take: CRAWL_PAGE_SIZE,
        select: listingLinkSelect,
      })
    : [];
  return { total, page: window.page, pageCount: window.pageCount, listings };
}

export async function relatedPublicListings(listing: { id: string; category: string; city: string }) {
  const category = listing.category.trim();
  const city = listing.city.trim();
  if (!category && !city) return [];
  const or = [...(category ? [{ category }] : []), ...(city ? [{ city }] : [])];
  const rows = await prisma.listing.findMany({
    where: publicListingWhere({ id: { not: listing.id }, OR: or }),
    select: { id: true, title: true, category: true, city: true, updatedAt: true, priceLabel: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  return selectRelatedListings(listing, rows, 8);
}

export type PublicShopGraph = {
  slug: string;
  name: string;
  updatedAt: Date;
  towns: string[];
  categories: string[];
};

export async function loadShopGraph(): Promise<PublicShopGraph[]> {
  const rows = await prisma.storefront.findMany({
    where: publicShopWhere({ published: true }),
    select: {
      slug: true,
      updatedAt: true,
      user: {
        select: {
          name: true,
          bio: true,
          city: true,
          email: true,
          suspended: true,
          verifiedPro: true,
          verifiedProUntil: true,
          listings: {
            where: publicListingWhere({}),
            select: { category: true, type: true, verified: true, featured: true, featuredUntil: true },
          },
        },
      },
      offerings: {
        where: { archived: false, hidden: false },
        select: { id: true, title: true, description: true },
      },
      branches: { select: { town: true } },
    },
  });
  return rows.flatMap((row) => {
    if (!row.slug || row.user.suspended) return [];
    const offerings = publicOfferingSlice(row.offerings, row.user);
    const categories = shopCategories({
      name: row.user.name,
      bio: row.user.bio,
      offerings,
      listings: row.user.listings,
    }).filter((category) => isCategory(category));
    const towns = [...new Set([row.user.city, ...row.branches.map((branch) => branch.town)].map((town) => town.trim()).filter(Boolean))];
    return [{ slug: row.slug, name: row.user.name, updatedAt: row.updatedAt, towns, categories }];
  });
}

export async function categoryHubCounts(category: string) {
  const where = publicListingWhere({ category });
  const [listings, samples, shops] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      select: { title: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    loadShopGraph(),
  ]);
  return {
    shops: shops.filter((shop) => shop.categories.includes(category)).length,
    listings,
    sampleTitles: samples.map((row) => row.title),
  };
}

export async function categoryShopPage(category: string, requested: number) {
  const shops = (await loadShopGraph()).filter((shop) => shop.categories.includes(category));
  shops.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.slug.localeCompare(b.slug));
  const window = pageWindow(shops.length, requested, CRAWL_PAGE_SIZE);
  return {
    total: shops.length,
    page: window.page,
    pageCount: window.pageCount,
    shops: shops.slice(window.start, window.start + CRAWL_PAGE_SIZE),
  };
}

export async function townHubFacts(city: string) {
  const where = publicListingWhere({ city });
  const [listings, shops, samples] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.storefront.count({ where: townShopFilter(city) }),
    prisma.listing.findMany({
      where,
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
  ]);
  return { listings, shops, samples };
}

export async function townListingPage(city: string, requested: number) {
  const where = publicListingWhere({ city });
  const total = await prisma.listing.count({ where });
  const window = pageWindow(total, requested, CRAWL_PAGE_SIZE);
  const listings = total
    ? await prisma.listing.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: window.start,
        take: CRAWL_PAGE_SIZE,
        select: listingLinkSelect,
      })
    : [];
  return { total, page: window.page, pageCount: window.pageCount, listings };
}

export async function townShopPage(city: string, requested: number) {
  const where = townShopFilter(city);
  const total = await prisma.storefront.count({ where });
  const window = pageWindow(total, requested, CRAWL_PAGE_SIZE);
  const shops = total
    ? await prisma.storefront.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { slug: "asc" }],
        skip: window.start,
        take: CRAWL_PAGE_SIZE,
        select: { slug: true, user: { select: { name: true } } },
      })
    : [];
  return { total, page: window.page, pageCount: window.pageCount, shops };
}

export async function footerHubLinks(limit = HUB_LINK_LIMIT): Promise<{ towns: HubLink[]; categories: HubLink[] }> {
  const [listingCategories, listingTowns, shops] = await Promise.all([
    prisma.listing.groupBy({
      by: ["category"],
      where: publicListingWhere({}),
      _count: { _all: true },
    }),
    prisma.listing.groupBy({
      by: ["city"],
      where: publicListingWhere({}),
      _count: { _all: true },
    }),
    loadShopGraph(),
  ]);
  const categoryCounts = new Map<string, number>();
  for (const row of listingCategories) {
    if (!isCategory(row.category)) continue;
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + row._count._all);
  }
  for (const shop of shops) {
    for (const category of new Set(shop.categories)) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const townCounts = new Map<string, { label: string; count: number; href: string }>();
  const addTown = (city: string, amount: number) => {
    const page = townPageForName(city);
    if (!page) return;
    const prev = townCounts.get(page.slug);
    if (!prev) {
      townCounts.set(page.slug, { label: page.city, count: amount, href: cityPagePath(page) });
      return;
    }
    prev.count += amount;
  };
  for (const row of listingTowns) addTown(row.city, row._count._all);
  for (const shop of shops) {
    const seen = new Set<string>();
    for (const town of shop.towns) {
      const page = townPageForName(town);
      if (!page || seen.has(page.slug)) continue;
      seen.add(page.slug);
      addTown(town, 1);
    }
  }
  return hubLinksFromCounts({
    towns: [...townCounts.values()],
    categories: [...categoryCounts.entries()].map(([label, count]) => ({ label, count })),
    limit,
  });
}

