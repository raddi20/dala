import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isFeatured } from "@/lib/utils";

const include = {
  reviews: { where: { hidden: false }, select: { rating: true } },
  owner: { select: { id: true, name: true, verifiedPro: true } },
} satisfies Prisma.ListingInclude;

export async function searchListings(filters: {
  q?: string;
  city?: string;
  region?: string;
  category?: string;
  type?: string;
  verified?: boolean;
  ownerId?: string;
  viewerId?: string | null;
  includeHidden?: boolean;
}) {
  const where: Prisma.ListingWhereInput = {};
  if (!filters.includeHidden) where.hidden = false;
  if (filters.city) where.city = filters.city;
  if (filters.region) where.region = filters.region;
  if (filters.category) where.category = filters.category;
  if (filters.type === "classifieds") where.type = { not: "business" };
  else if (filters.type) where.type = filters.type;
  if (filters.verified) where.verified = true;
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q } },
      { description: { contains: filters.q } },
      { address: { contains: filters.q } },
    ];
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
    take: 100,
  });

  return rows.sort((a, b) => {
    const featuredDelta = Number(isFeatured(b)) - Number(isFeatured(a));
    if (featuredDelta !== 0) return featuredDelta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export type ListingCardData = Awaited<ReturnType<typeof searchListings>>[number];
