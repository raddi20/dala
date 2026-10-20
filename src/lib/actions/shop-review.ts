"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindow } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import {
  SHOP_REVIEW_LIMIT,
  SHOP_REVIEW_LIMIT_MESSAGE,
  SHOP_REVIEW_WINDOW_MS,
  checkShopReview,
} from "@/lib/shop-review";
import { field, type ActionState } from "@/lib/validators";

export async function createShopReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to rate this shop." };

  const shop = await prisma.storefront.findUnique({
    where: { id: field(formData, "storefrontId") },
    select: { id: true, slug: true, userId: true, published: true, hidden: true, user: { select: { suspended: true } } },
  });
  if (!shop || !shop.published || shop.hidden || shop.user.suspended) return { error: "Shop not found." };
  if (shop.userId === user.id) return { error: "You can't rate your own shop." };

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: shop.userId },
        { blockerId: shop.userId, blockedId: user.id },
      ],
    },
    select: { id: true },
  });
  if (blocked) return { error: "You can't rate this shop." };

  const checked = checkShopReview({ rating: field(formData, "rating"), body: field(formData, "body") });
  if (!checked.ok) return { error: checked.error };

  const existing = await prisma.shopReview.findUnique({
    where: { storefrontId_authorId: { storefrontId: shop.id, authorId: user.id } },
    select: { status: true },
  });
  if (existing?.status === "hidden") return { error: "A moderator hid your review of this shop, so it stays hidden." };

  const gate = await consumeFixedWindow({
    action: "shop_review",
    subject: user.id,
    limit: SHOP_REVIEW_LIMIT,
    windowMs: SHOP_REVIEW_WINDOW_MS,
  });
  if (gate.limited) return { error: SHOP_REVIEW_LIMIT_MESSAGE };

  await prisma.shopReview.upsert({
    where: { storefrontId_authorId: { storefrontId: shop.id, authorId: user.id } },
    create: { storefrontId: shop.id, authorId: user.id, rating: checked.rating, body: checked.body, status: checked.status },
    update: { rating: checked.rating, body: checked.body, status: checked.status, moderatedAt: null },
  });

  revalidatePath(`/b/${shop.slug}`);
  revalidatePath("/admin");
  return {
    error: "",
    ok: true,
    message:
      checked.status === "pending"
        ? "Thanks. Reviews with a link or phone number are checked by a moderator before they show."
        : existing
          ? "Thanks. Your review is updated."
          : "Thanks for your review.",
  };
}
