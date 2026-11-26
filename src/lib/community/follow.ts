import { isDemoEmail } from "@/lib/admin-access";

export const FOLLOW_LIMIT = 30;
export const FOLLOW_WINDOW_MS = 60 * 60 * 1000;
export const FOLLOW_LIMIT_MESSAGE = "That's a lot of follows in a short time. Wait a little and try again.";

export type ShopSnap = {
  id: string;
  ownerId: string;
  ownerEmail: string;
  published: boolean;
  hidden: boolean;
  ownerSuspended: boolean;
};

export type FollowCode = "missing" | "demo" | "own" | "closed" | "limited";

export const FOLLOW_ERRORS: Record<FollowCode, string> = {
  missing: "That shop is not available.",
  demo: "This shop is a sample, so it can't be followed.",
  own: "This is your shop.",
  closed: "This shop is not open yet.",
  limited: FOLLOW_LIMIT_MESSAGE,
};

/** Demo shops and demo followers never count. */
export function countsAsFollower(followerEmail: string, shopOwnerEmail: string): boolean {
  return !isDemoEmail(followerEmail) && !isDemoEmail(shopOwnerEmail);
}

export function followerTotal(rows: { followerEmail: string; ownerEmail: string }[]): number {
  return rows.filter((row) => countsAsFollower(row.followerEmail, row.ownerEmail)).length;
}

export type FollowStore = {
  getShop(id: string): Promise<ShopSnap | null>;
  isFollowing(userId: string, shopId: string): Promise<boolean>;
  add(userId: string, shopId: string): Promise<void>;
  remove(userId: string, shopId: string): Promise<void>;
};

export type FollowOutcome =
  | { ok: true; following: boolean; changed: boolean }
  | { ok: false; code: FollowCode };

/**
 * Toggle deletes the row. intent "follow" only adds, so a sign-in return
 * applies the follow and never undoes one.
 */
export async function applyFollow(
  store: FollowStore,
  input: {
    userId: string;
    userEmail: string;
    shopId: string;
    limited: boolean;
    intent: "toggle" | "follow";
  },
): Promise<FollowOutcome> {
  if (input.limited) return { ok: false, code: "limited" };
  const shop = await store.getShop(input.shopId);
  if (!shop) return { ok: false, code: "missing" };
  if (isDemoEmail(shop.ownerEmail) || isDemoEmail(input.userEmail)) return { ok: false, code: "demo" };
  if (shop.ownerId === input.userId) return { ok: false, code: "own" };
  if (!shop.published || shop.hidden || shop.ownerSuspended) return { ok: false, code: "closed" };
  const following = await store.isFollowing(input.userId, shop.id);
  if (input.intent === "follow") {
    if (!following) await store.add(input.userId, shop.id);
    return { ok: true, following: true, changed: !following };
  }
  if (following) {
    await store.remove(input.userId, shop.id);
    return { ok: true, following: false, changed: true };
  }
  await store.add(input.userId, shop.id);
  return { ok: true, following: true, changed: true };
}
