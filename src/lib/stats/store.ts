import { prisma } from "@/lib/prisma";
import type { StatStore } from "@/lib/stats/track";

export function prismaStatStore(): StatStore {
  return {
    async findListing(id) {
      const row = await prisma.listing.findUnique({
        where: { id },
        select: { id: true, hidden: true, owner: { select: { suspended: true } } },
      });
      if (!row) return null;
      return { id: row.id, hidden: row.hidden || row.owner.suspended };
    },
    async findShop(slug) {
      const row = await prisma.storefront.findUnique({
        where: { slug },
        select: { id: true, published: true, hidden: true, user: { select: { suspended: true } } },
      });
      if (!row) return null;
      return { id: row.id, published: row.published && !row.hidden && !row.user.suspended };
    },
    countRecent(sessionHash, since) {
      return prisma.statEvent.count({ where: { sessionHash, createdAt: { gte: since } } });
    },
    async hasRecentView(query) {
      const row = await prisma.statEvent.findFirst({
        where: {
          sessionHash: query.sessionHash,
          kind: query.kind,
          listingId: query.listingId,
          storefrontId: query.storefrontId,
          createdAt: { gte: query.since },
        },
        select: { id: true },
      });
      return Boolean(row);
    },
    async insert(row) {
      await prisma.statEvent.create({ data: row });
    },
  };
}
