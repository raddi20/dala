import { prisma } from "@/lib/prisma";
import type { FollowStore } from "@/lib/community/follow";

export function prismaFollowStore(): FollowStore {
  return {
    async getShop(id) {
      const shop = await prisma.storefront.findUnique({
        where: { id },
        select: {
          id: true,
          published: true,
          hidden: true,
          user: { select: { id: true, email: true, suspended: true } },
        },
      });
      if (!shop) return null;
      return {
        id: shop.id,
        ownerId: shop.user.id,
        ownerEmail: shop.user.email,
        published: shop.published,
        hidden: shop.hidden,
        ownerSuspended: shop.user.suspended,
      };
    },
    async isFollowing(userId, shopId) {
      const row = await prisma.shopFollow.findUnique({
        where: { userId_shopId: { userId, shopId } },
        select: { id: true },
      });
      return Boolean(row);
    },
    async add(userId, shopId) {
      await prisma.shopFollow.upsert({
        where: { userId_shopId: { userId, shopId } },
        create: { userId, shopId },
        update: {},
      });
    },
    async remove(userId, shopId) {
      await prisma.shopFollow.deleteMany({ where: { userId, shopId } });
    },
  };
}

export async function followedIdSet(userId: string, shopIds: string[]): Promise<Set<string>> {
  if (!userId || shopIds.length === 0) return new Set();
  const rows = await prisma.shopFollow.findMany({
    where: { userId, shopId: { in: shopIds } },
    select: { shopId: true },
  });
  return new Set(rows.map((row) => row.shopId));
}

const realFollower = { email: { not: { endsWith: "@dala.local" } }, suspended: false };

export async function countFollowers(shopId: string): Promise<number> {
  return prisma.shopFollow.count({
    where: {
      shopId,
      user: realFollower,
      shop: { user: { email: { not: { endsWith: "@dala.local" } } } },
    },
  });
}

export async function shopsFollowedBy(userId: string) {
  return prisma.shopFollow.findMany({
    where: {
      userId,
      shop: { published: true, hidden: false, user: { suspended: false, email: { not: { endsWith: "@dala.local" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      shop: {
        select: {
          id: true,
          slug: true,
          user: { select: { name: true, city: true } },
        },
      },
    },
  });
}
