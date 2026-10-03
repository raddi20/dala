import { Prisma } from "@prisma/client";
import { diasporaOrdersWhere } from "@/lib/diaspora";
import { prisma } from "@/lib/prisma";
import { shopBadgeWhere } from "@/lib/shop-badges";
import { isFeatured } from "@/lib/utils";

const include = {
  reviews: { where: { hidden: false }, select: { rating: true } },
  owner: {
    select: {
      id: true,
      name: true,
      verifiedPro: true,
      storefront: {
        select: {
          slug: true,
          published: true,
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

export async function searchListings(filters: {
  q?: string;
  /** Any of these words may match. Used when a sentence left no category or place. */
  words?: string[];
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
}) {
  const where: Prisma.ListingWhereInput = {};
  if (!filters.includeHidden) where.hidden = false;
  if (filters.ids) where.id = { in: filters.ids };
  if (filters.city) where.city = filters.city;
  if (filters.region) where.region = filters.region;
  if (filters.category) where.category = filters.category;
  if (filters.type === "classifieds") where.type = { not: "business" };
  else if (filters.type) where.type = filters.type;
  if (filters.verified) where.verified = true;
  if (filters.occasion) where.occasions = { some: { occasion: { slug: filters.occasion } } };
  const badgeWhere = shopBadgeWhere(filters.badge);
  const diasporaWhere = diasporaOrdersWhere(filters.diaspora);
  const extra = [badgeWhere, diasporaWhere].filter((item) => item !== null);
  if (extra.length > 0) {
    const current = where.AND;
    const list = Array.isArray(current) ? current : current ? [current] : [];
    where.AND = [...list, ...extra];
  }
  const words = (filters.words ?? []).map((word) => word.trim()).filter((word) => word.length > 2).slice(0, 6);
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q } },
      { description: { contains: filters.q } },
      { address: { contains: filters.q } },
    ];
  } else if (words.length > 0) {
    where.OR = words.flatMap((word) => [
      { title: { contains: word } },
      { description: { contains: word } },
      { address: { contains: word } },
    ]);
  }
  const blockedIds = filters.viewerId
    ? (
        await prisma.block.findMany({
          where: { blockerId: filters.viewerId },
          select: { blockedId: true },
        })
      ).map((block) => block.blockedId)
    : [];
  if (filters.ownerId && blockedIds.length > 0) {
    where.ownerId = { equals: filters.ownerId, notIn: blockedIds };
  } else if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  } else if (blockedIds.length > 0) {
    where.ownerId = { notIn: blockedIds };
  }

  const rows = await prisma.listing.findMany({
    where,
    include,
    orderBy: { createdAt: "desc" },
    take: filters.ids?.length ? filters.ids.length : 100,
  });

  return rows.sort((a, b) => {
    const featuredDelta = Number(isFeatured(b)) - Number(isFeatured(a));
    if (featuredDelta !== 0) return featuredDelta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export type ListingCardData = Awaited<ReturnType<typeof searchListings>>[number];
