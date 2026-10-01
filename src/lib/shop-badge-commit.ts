import type { PrismaClient } from "@prisma/client";
import {
  planShopBadgeChange,
  type ShopBadgeAdmin,
  type ShopBadgeFlags,
} from "@/lib/shop-badges";

const CLOSED: ShopBadgeFlags = {
  phoneVerified: false,
  locationVerified: false,
  businessVerified: false,
};

export type CommitShopBadgeResult =
  | { ok: false; code: "forbidden" | "invalid" | "missing" }
  | { ok: true; unchanged: boolean; slug: string; userId: string };

/**
 * Applies one shop-badge change and appends an audit row in the same transaction.
 * Refuses non-admins before reading the shop. Does not update or delete existing audit rows.
 */
export async function commitShopBadgeChange(
  db: PrismaClient,
  input: {
    role: string;
    storefrontId: string;
    badge: string;
    action: string;
    method?: string;
    note: string;
    admin: ShopBadgeAdmin;
    now?: Date;
  },
): Promise<CommitShopBadgeResult> {
  const now = input.now ?? new Date();
  const gate = planShopBadgeChange({
    role: input.role,
    state: CLOSED,
    badge: input.badge,
    action: input.action,
    method: input.method,
    note: input.note,
    admin: input.admin,
    storefrontId: input.storefrontId,
    now,
  });
  if (!gate.ok) return gate;

  return db.$transaction(async (tx) => {
    const shop = await tx.storefront.findUnique({ where: { id: input.storefrontId.trim() } });
    if (!shop) return { ok: false as const, code: "missing" as const };

    const planned = planShopBadgeChange({
      role: input.role,
      state: shop,
      badge: input.badge,
      action: input.action,
      method: input.method,
      note: input.note,
      admin: input.admin,
      storefrontId: shop.id,
      now,
    });
    if (!planned.ok) return planned;
    if (planned.unchanged) {
      return { ok: true as const, unchanged: true as const, slug: shop.slug, userId: shop.userId };
    }

    await tx.storefront.update({ where: { id: shop.id }, data: planned.data });
    await tx.shopBadgeEvent.create({ data: planned.event });
    return { ok: true as const, unchanged: false as const, slug: shop.slug, userId: shop.userId };
  });
}
