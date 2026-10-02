import { prisma } from "@/lib/prisma";
import type { StatStore } from "@/lib/stats/track";

export function prismaStatStore(): StatStore {
  return {
    findListing(id) {
      return prisma.listing.findUnique({ where: { id }, select: { id: true, hidden: true } });
    },
    findShop(slug) {
      return prisma.storefront.findUnique({ where: { slug }, select: { id: true, published: true } });
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
