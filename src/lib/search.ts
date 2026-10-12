import { Prisma } from "@prisma/client";
import { hiddenDemoUserFilter, publicListingWhere, publicSellerContacts, publicShopWhere } from "@/lib/demo-visibility";
import { diasporaOrdersWhere } from "@/lib/diaspora";
import { firstPhoto } from "@/lib/item-card";
import { regionForCity } from "@/lib/constants";
import { rankByHints } from "@/lib/nl-query";
import { prisma } from "@/lib/prisma";
import { shopBadgeWhere, storefrontBadgeWhere } from "@/lib/shop-badges";
import {
  displayOfferingCategory,
  displayShopCategory,
  offeringCategories,
  offeringIsPublic,
  publicOfferingSlice,
  shopCategories,
} from "@/lib/shop-category";
import { containsFilter, matchTerms } from "@/lib/search-text";
import { isFeatured } from "@/lib/utils";
import { publicReviewWhere } from "@/lib/visibility";

type Env = Record<string, string | undefined>;

const include = {
  reviews: { where: publicReviewWhere, select: { rating: true } },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      verifiedPro: true,
      verifiedProUntil: true,
      storefront: {
        select: {
          slug: true,
          published: true,
          hidden: true,
          phoneVerified: true,
          locationVerified: true,
          businessVerified: true,
          servesDiaspora: true,
          videos: {
            where: { status: "approved", NOT: { publicPlaybackId: "" } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.ListingInclude;

const offeringOrder = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

function shopCardSelect(env: Env) {
  return {
  id: true,
  slug: true,
  createdAt: true,
  phoneVerified: true,
  locationVerified: true,
  businessVerified: true,
  servesDiaspora: true,
  bannerUrl: true,
  user: {
    select: {
      name: true,
      bio: true,
      city: true,
      avatarUrl: true,
      verifiedPro: true,
      verifiedProUntil: true,
      listings: {
        where: publicListingWhere({}, env),
        orderBy: { createdAt: "asc" as const },
        select: {
          category: true,
          type: true,
          verified: true,
          featured: true,
          featuredUntil: true,
        },
      },
    },
  },
  offerings: {
    where: { archived: false, hidden: false },
    orderBy: offeringOrder,
    select: { id: true, title: true, description: true, imageUrl: true },
  },
} satisfies Prisma.StorefrontSelect;
}

const offeringCardSelect = {
  id: true,
  title: true,
  description: true,
  priceCents: true,
  currency: true,
  imageUrl: true,
  createdAt: true,
  storefront: {
    select: {
      slug: true,
      phoneVerified: true,
      locationVerified: true,
      businessVerified: true,
      offerings: {
        where: { archived: false, hidden: false },
        orderBy: offeringOrder,
        select: { id: true },
      },
      user: {
        select: {
          name: true,
          city: true,
          verifiedPro: true,
          verifiedProUntil: true,
        },
      },
    },
  },
} satisfies Prisma.OfferingSelect;

type ShopRow = Prisma.StorefrontGetPayload<{ select: ReturnType<typeof shopCardSelect> }>;
type OfferingRow = Prisma.OfferingGetPayload<{ select: typeof offeringCardSelect }>;

export type SearchFilters = {
  q?: string;
  /** Any of these words may match. Used when a sentence left no category or place. */
  words?: string[];
  /** Reorders matches. Does not drop rows. */
  hints?: string[];
  city?: string;
  region?: string;
  category?: string;
  type?: string;
  verified?: boolean;
  badge?: string;
  diaspora?: boolean;
  occasion?: string;
  ids?: string[];
  ownerId?: string;
  viewerId?: string | null;
  includeHidden?: boolean;
  page?: number;
  pageSize?: number;
};

export const BROWSE_PAGE_SIZE = 24;

export function browsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 500);
}

type Indexed = {
  kind: "listing" | "shop" | "offering";
  id: string;
  createdAt: Date;
  featured: boolean;
  title: string;
  description: string;
  address: string;
};

function listingWhere(filters: SearchFilters, blocked: string[], env: Env): Prisma.ListingWhereInput {
  const extra: Prisma.ListingWhereInput = {};
  if (filters.ids) extra.id = { in: filters.ids };
  if (filters.city) extra.city = filters.city;
  if (filters.region) extra.region = filters.region;
  if (filters.category) extra.category = filters.category;
  if (filters.type === "classifieds") extra.type = { not: "business" };
  else if (filters.type) extra.type = filters.type;
  if (filters.verified) extra.verified = true;
  if (filters.occasion) extra.occasions = { some: { occasion: { slug: filters.occasion } } };

  const and: Prisma.ListingWhereInput[] = [];
  const badgeWhere = shopBadgeWhere(filters.badge);
  const diasporaWhere = diasporaOrdersWhere(filters.diaspora);
  if (badgeWhere) and.push(badgeWhere);
  if (diasporaWhere) and.push(diasporaWhere);
  const terms = matchTerms(filters);
  if (terms.length > 0) {
    extra.OR = terms.flatMap((term) => [
      { title: containsFilter(term, env) },
      { description: containsFilter(term, env) },
      { address: containsFilter(term, env) },
    ]);
  }
  if (filters.ownerId && blocked.length > 0) extra.ownerId = { equals: filters.ownerId, notIn: blocked };
  else if (filters.ownerId) extra.ownerId = filters.ownerId;
  else if (blocked.length > 0) extra.ownerId = { notIn: blocked };

  if (filters.includeHidden) {
    const demo = hiddenDemoUserFilter(env);
    if (demo) and.push({ owner: demo });
    if (and.length > 0) extra.AND = and;
    return extra;
  }
  if (and.length > 0) extra.AND = and;
  return publicListingWhere(extra, env);
}

function userWhere(filters: SearchFilters, blocked: string[]): Prisma.UserWhereInput | undefined {
  const and: Prisma.UserWhereInput[] = [];
  if (filters.city) and.push({ city: filters.city });
  if (filters.region === "diaspora") and.push({ city: "London" });
  if (filters.region === "homeland") and.push({ city: { not: "London" } });
  if (blocked.length > 0) and.push({ id: { notIn: blocked } });
  if (and.length === 0) return undefined;
  if (and.length === 1) return and[0];
  return { AND: and };
}

function storefrontWhere(
  filters: SearchFilters,
  blocked: string[],
  env: Env,
  verified: "off" | "listing" | "shop",
  withText: boolean,
): Prisma.StorefrontWhereInput {
  const and: Prisma.StorefrontWhereInput[] = [];
  const badge = storefrontBadgeWhere(filters.badge);
  if (badge) and.push(badge);
  if (filters.diaspora) and.push({ servesDiaspora: true });
  if (filters.occasion) and.push({ occasions: { some: { occasion: { slug: filters.occasion } } } });
  if (verified === "listing") {
    and.push({ user: { listings: { some: publicListingWhere({ verified: true }, env) } } });
  }
  if (verified === "shop") {
    and.push({
      OR: [
        { phoneVerified: true },
        { locationVerified: true },
        { businessVerified: true },
        { user: { listings: { some: publicListingWhere({ verified: true }, env) } } },
      ],
    });
  }
  const user = userWhere(filters, blocked);
  if (user) and.push({ user });
  if (withText) {
    const terms = matchTerms(filters);
    if (terms.length > 0) {
      and.push({
        OR: terms.flatMap((term) => {
          const contains = containsFilter(term, env);
          return [
            { user: { name: contains } },
            { user: { bio: contains } },
            { user: { city: contains } },
            { offerings: { some: { archived: false, hidden: false, title: contains } } },
            { offerings: { some: { archived: false, hidden: false, description: contains } } },
            { occasions: { some: { occasion: { title: contains } } } },
          ];
        }),
      });
    }
  }
  return publicShopWhere({ published: true, ...(and.length > 0 ? { AND: and } : {}) }, env);
}

function offeringWhere(
  filters: SearchFilters,
  blocked: string[],
  env: Env,
  verified: "off" | "listing",
): Prisma.OfferingWhereInput {
  const and: Prisma.OfferingWhereInput[] = [
    { archived: false, hidden: false },
    { storefront: storefrontWhere(filters, blocked, env, verified, false) },
  ];
  const terms = matchTerms(filters);
  if (terms.length > 0) {
    and.push({
      OR: terms.flatMap((term) => {
        const contains = containsFilter(term, env);
        return [{ title: contains }, { description: contains }];
      }),
    });
  }
  return { AND: and };
}

/** Shops and offerings are businesses. Classifieds and other listing types stay listings only. */
function includeShops(filters: SearchFilters): boolean {
  if (filters.ids || filters.ownerId || filters.includeHidden) return false;
  const type = filters.type ?? "";
  return type === "" || type === "business";
}

function shopContent(row: ShopRow) {
  const offerings = publicOfferingSlice(row.offerings, row.user);
  return {
    name: row.user.name,
    bio: row.user.bio,
    offerings,
    listings: row.user.listings,
  };
}

function toShopCard(row: ShopRow): ShopCardData {
  const content = shopContent(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.user.name,
    category: displayShopCategory(content),
    city: row.user.city,
    region: regionForCity(row.user.city),
    verified: row.user.listings.some((listing) => listing.verified),
    phoneVerified: row.phoneVerified,
    locationVerified: row.locationVerified,
    businessVerified: row.businessVerified,
    servesDiaspora: row.servesDiaspora,
    coverUrl: firstPhoto([...content.offerings.map((offering) => offering.imageUrl), row.bannerUrl]),
    avatarUrl: row.user.avatarUrl,
  };
}

function toOfferingCard(row: OfferingRow): OfferingCardData {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    category: displayOfferingCategory(row.title, row.description),
    shopSlug: row.storefront.slug,
    shopName: row.storefront.user.name,
    city: row.storefront.user.city,
    region: regionForCity(row.storefront.user.city),
    phoneVerified: row.storefront.phoneVerified,
    locationVerified: row.storefront.locationVerified,
    businessVerified: row.storefront.businessVerified,
  };
}

function shopMatches(row: ShopRow, category: string): boolean {
  if (!category) return true;
  return shopCategories(shopContent(row)).includes(category);
}

async function blockedIds(viewerId?: string | null): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await prisma.block.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
  });
  return rows.map((block) => block.blockedId);
}

function sortIndexed(rows: Indexed[], hints: string[]): Indexed[] {
  const ordered = [...rows].sort((left, right) => {
    const featuredDelta = Number(right.featured) - Number(left.featured);
    if (featuredDelta !== 0) return featuredDelta;
    const time = right.createdAt.getTime() - left.createdAt.getTime();
    if (time !== 0) return time;
    return left.id < right.id ? -1 : 1;
  });
  if (hints.length === 0) return ordered;
  return rankByHints(ordered, hints);
}

function pageWindow(total: number, requested: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = total === 0 ? 1 : Math.min(Math.max(requested, 1), pageCount);
  return { page, pageCount, start: (page - 1) * pageSize };
}

export async function searchListings(filters: SearchFilters, env: Env = process.env) {
  const blocked = await blockedIds(filters.viewerId);
  const where = listingWhere(filters, blocked, env);
  const rows = await prisma.listing.findMany({
    where,
    include,
    orderBy: { createdAt: "desc" },
    take: filters.ids?.length ? filters.ids.length : 100,
  });

  return rows
    .sort((a, b) => {
      const featuredDelta = Number(isFeatured(b)) - Number(isFeatured(a));
      if (featuredDelta !== 0) return featuredDelta;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((row) => toPublicListing(row));
}

/** Public card data. The owner's login email is dropped so it cannot ride along in a payload. */
export function toPublicListing<T extends { owner: { email: string }; contactPhone: string; contactWhatsapp: string }>(row: T) {
  const contacts = publicSellerContacts({
    email: row.owner.email,
    phone: row.contactPhone,
    whatsapp: row.contactWhatsapp,
  });
  const owner = Object.fromEntries(Object.entries(row.owner).filter(([key]) => key !== "email")) as Omit<T["owner"], "email">;
  return {
    ...row,
    contactPhone: contacts.phone,
    contactWhatsapp: contacts.whatsapp,
    owner,
  };
}

export type ListingCardData = Awaited<ReturnType<typeof searchListings>>[number];

export type ShopCardData = {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  region: string;
  verified: boolean;
  phoneVerified: boolean;
  locationVerified: boolean;
  businessVerified: boolean;
  servesDiaspora: boolean;
  coverUrl: string;
  avatarUrl: string;
};

export type OfferingCardData = {
  id: string;
  title: string;
  description: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string;
  createdAt: Date;
  category: string;
  shopSlug: string;
  shopName: string;
  city: string;
  region: string;
  phoneVerified: boolean;
  locationVerified: boolean;
  businessVerified: boolean;
};

export type CatalogueHit =
  | { kind: "listing"; listing: ListingCardData }
  | { kind: "shop"; shop: ShopCardData }
  | { kind: "offering"; offering: OfferingCardData };

export type CataloguePage = {
  hits: CatalogueHit[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function searchCatalogue(filters: SearchFilters, env: Env = process.env): Promise<CataloguePage> {
  const pageSize = filters.pageSize ?? BROWSE_PAGE_SIZE;
  const blocked = await blockedIds(filters.viewerId);
  const hints = (filters.hints ?? []).map((hint) => hint.trim()).filter((hint) => hint.length > 2).slice(0, 6);
  const category = filters.category ?? "";
  const shopsOn = includeShops(filters);

  const listingRows = await prisma.listing.findMany({
    where: listingWhere(filters, blocked, env),
    select: {
      id: true,
      createdAt: true,
      featured: true,
      featuredUntil: true,
      title: true,
      description: true,
      address: true,
    },
  });

  const indexed: Indexed[] = listingRows.map((row) => ({
    kind: "listing" as const,
    id: row.id,
    createdAt: row.createdAt,
    featured: isFeatured(row),
    title: row.title,
    description: row.description,
    address: row.address,
  }));

  const shopCards = new Map<string, ShopCardData>();
  const offeringCards = new Map<string, OfferingCardData>();

  if (shopsOn) {
    const shopRows = await prisma.storefront.findMany({
      where: storefrontWhere(filters, blocked, env, filters.verified ? "listing" : "off", true),
      select: shopCardSelect(env),
    });
    for (const row of shopRows) {
      if (!shopMatches(row, category)) continue;
      shopCards.set(row.id, toShopCard(row));
      const content = shopContent(row);
      indexed.push({
        kind: "shop",
        id: row.id,
        createdAt: row.createdAt,
        featured: false,
        title: row.user.name,
        description: [row.user.bio, ...content.offerings.map((offering) => `${offering.title} ${offering.description}`)].join("\n"),
        address: row.user.city,
      });
    }

    const offeringRows = await prisma.offering.findMany({
      where: offeringWhere(filters, blocked, env, filters.verified ? "listing" : "off"),
      select: offeringCardSelect,
    });
    for (const row of offeringRows) {
      if (!offeringIsPublic(row.id, row.storefront.offerings, row.storefront.user)) continue;
      if (category && !offeringCategories(row.title, row.description).includes(category)) continue;
      offeringCards.set(row.id, toOfferingCard(row));
      indexed.push({
        kind: "offering",
        id: row.id,
        createdAt: row.createdAt,
        featured: false,
        title: row.title,
        description: row.description,
        address: row.storefront.user.city,
      });
    }
  }

  const ordered = sortIndexed(indexed, hints);
  const total = ordered.length;
  const window = pageWindow(total, filters.page ?? 1, pageSize);
  const slice = ordered.slice(window.start, window.start + pageSize);
  const hits = await hydrateHits(slice, shopCards, offeringCards);
  return { hits, total, page: window.page, pageSize, pageCount: window.pageCount };
}

async function hydrateHits(
  slice: Indexed[],
  shopCards: Map<string, ShopCardData>,
  offeringCards: Map<string, OfferingCardData>,
): Promise<CatalogueHit[]> {
  const listingIds = slice.filter((hit) => hit.kind === "listing").map((hit) => hit.id);
  const listings = listingIds.length
    ? (await prisma.listing.findMany({ where: { id: { in: listingIds } }, include })).map((row) => toPublicListing(row))
    : [];
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const hits: CatalogueHit[] = [];
  for (const hit of slice) {
    if (hit.kind === "listing") {
      const listing = listingById.get(hit.id);
      if (listing) hits.push({ kind: "listing", listing });
      continue;
    }
    if (hit.kind === "shop") {
      const shop = shopCards.get(hit.id);
      if (shop) hits.push({ kind: "shop", shop });
      continue;
    }
    const offering = offeringCards.get(hit.id);
    if (offering) hits.push({ kind: "offering", offering });
  }
  return hits;
}

export async function searchShops(filters: SearchFilters, env: Env = process.env) {
  const pageSize = filters.pageSize ?? BROWSE_PAGE_SIZE;
  const blocked = await blockedIds(filters.viewerId);
  const where = storefrontWhere(filters, blocked, env, filters.verified ? "shop" : "off", true);
  const category = filters.category ?? "";
  if (category) {
    const rows = await prisma.storefront.findMany({
      where,
      select: shopCardSelect(env),
      orderBy: { createdAt: "desc" },
    });
    const matched = rows.filter((row) => shopMatches(row, category));
    const window = pageWindow(matched.length, filters.page ?? 1, pageSize);
    return {
      shops: matched.slice(window.start, window.start + pageSize).map(toShopCard),
      total: matched.length,
      page: window.page,
      pageSize,
      pageCount: window.pageCount,
    };
  }
  const total = await prisma.storefront.count({ where });
  const window = pageWindow(total, filters.page ?? 1, pageSize);
  const rows = await prisma.storefront.findMany({
    where,
    select: shopCardSelect(env),
    orderBy: { createdAt: "desc" },
    skip: window.start,
    take: pageSize,
  });
  return {
    shops: rows.map(toShopCard),
    total,
    page: window.page,
    pageSize,
    pageCount: window.pageCount,
  };
}

/** Published shops per category. Taken-down shops, hidden offerings, hidden listings, and suspended owners are left out. */
export async function shopCategoryCounts(env: Env = process.env): Promise<Map<string, number>> {
  const rows = await prisma.storefront.findMany({
    where: publicShopWhere({ published: true }, env),
    select: {
      user: {
        select: {
          name: true,
          bio: true,
          verifiedPro: true,
          verifiedProUntil: true,
          listings: {
            where: publicListingWhere({}, env),
            select: {
              category: true,
              type: true,
              verified: true,
              featured: true,
              featuredUntil: true,
            },
          },
        },
      },
      offerings: {
        where: { archived: false, hidden: false },
        orderBy: offeringOrder,
        select: { id: true, title: true, description: true },
      },
    },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const offerings = publicOfferingSlice(row.offerings, row.user);
    for (const category of shopCategories({
      name: row.user.name,
      bio: row.user.bio,
      offerings,
      listings: row.user.listings,
    })) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return counts;
}

export async function homeRails(viewerId?: string | null, env: Env = process.env) {
  const blocked = await blockedIds(viewerId);
  const where = listingWhere({ viewerId }, blocked, env);
  const [featuredRows, classifiedRows, shops, offerings] = await Promise.all([
    prisma.listing.findMany({
      where: { AND: [where, { featured: true }] },
      include,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.listing.findMany({
      where: { AND: [where, { type: { not: "business" } }] },
      include,
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    searchShops({ viewerId, page: 1, pageSize: 4 }, env),
    recentOfferings(4, viewerId, env),
  ]);
  return {
    featured: featuredRows.map((row) => toPublicListing(row)).filter((listing) => isFeatured(listing)).slice(0, 4),
    classifieds: classifiedRows.map((row) => toPublicListing(row)),
    shops: shops.shops,
    offerings,
  };
}

async function recentOfferings(limit: number, viewerId?: string | null, env: Env = process.env) {
  const blocked = await blockedIds(viewerId);
  const rows = await prisma.offering.findMany({
    where: offeringWhere({}, blocked, env, "off"),
    select: offeringCardSelect,
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 5, 20),
  });
  const cards: OfferingCardData[] = [];
  for (const row of rows) {
    if (!offeringIsPublic(row.id, row.storefront.offerings, row.storefront.user)) continue;
    cards.push(toOfferingCard(row));
    if (cards.length >= limit) break;
  }
  return cards;
}
