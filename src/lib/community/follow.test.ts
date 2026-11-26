import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyFollow, countsAsFollower, followerTotal, type FollowStore, type ShopSnap } from "@/lib/community/follow";

const shop: ShopSnap = {
  id: "shop1",
  ownerId: "owner",
  ownerEmail: "nyangoma@example.com",
  published: true,
  hidden: false,
  ownerSuspended: false,
};

function memory(): FollowStore & { rows: Set<string> } {
  const rows = new Set<string>();
  const key = (userId: string, shopId: string) => `${userId}:${shopId}`;
  return {
    rows,
    async getShop(id) {
      return id === shop.id ? shop : null;
    },
    async isFollowing(userId, shopId) {
      return rows.has(key(userId, shopId));
    },
    async add(userId, shopId) {
      rows.add(key(userId, shopId));
    },
    async remove(userId, shopId) {
      rows.delete(key(userId, shopId));
    },
  };
}

test("follow toggles the row on and unfollow deletes it", async () => {
  const store = memory();
  const on = await applyFollow(store, { userId: "buyer", userEmail: "buyer@example.com", shopId: shop.id, limited: false, intent: "toggle" });
  assert.deepEqual(on, { ok: true, following: true, changed: true });
  assert.equal(store.rows.size, 1);
  const off = await applyFollow(store, { userId: "buyer", userEmail: "buyer@example.com", shopId: shop.id, limited: false, intent: "toggle" });
  assert.deepEqual(off, { ok: true, following: false, changed: true });
  assert.equal(store.rows.size, 0);
});

test("a sign-in return follows and does not unfollow", async () => {
  const store = memory();
  await applyFollow(store, { userId: "buyer", userEmail: "buyer@example.com", shopId: shop.id, limited: false, intent: "follow" });
  const again = await applyFollow(store, { userId: "buyer", userEmail: "buyer@example.com", shopId: shop.id, limited: false, intent: "follow" });
  assert.equal(again.ok && again.following, true);
  assert.equal(store.rows.size, 1);
});

test("demo shops, your own shop, closed shops, and a rate limit are refused", async () => {
  const store = memory();
  const demo = await applyFollow(
    { ...store, async getShop() { return { ...shop, ownerEmail: "atieno@dala.local" }; } },
    { userId: "buyer", userEmail: "buyer@example.com", shopId: shop.id, limited: false, intent: "toggle" },
  );
  assert.equal(demo.ok, false);
  if (!demo.ok) assert.equal(demo.code, "demo");
  const own = await applyFollow(store, { userId: "owner", userEmail: "nyangoma@example.com", shopId: shop.id, limited: false, intent: "toggle" });
  assert.equal(own.ok, false);
  const limited = await applyFollow(store, { userId: "buyer", userEmail: "buyer@example.com", shopId: shop.id, limited: true, intent: "toggle" });
  assert.equal(limited.ok, false);
  assert.equal(store.rows.size, 0);
});

test("demo followers and demo shops are left out of the count", () => {
  assert.equal(countsAsFollower("buyer@example.com", "atieno@dala.local"), false);
  assert.equal(countsAsFollower("akinyi@dala.local", "nyangoma@example.com"), false);
  assert.equal(
    followerTotal([
      { followerEmail: "buyer@example.com", ownerEmail: "nyangoma@example.com" },
      { followerEmail: "akinyi@dala.local", ownerEmail: "nyangoma@example.com" },
    ]),
    1,
  );
});

test("account deletion cascades follows", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
  const model = schema.slice(schema.indexOf("model ShopFollow"), schema.indexOf("model ShopUpdate"));
  assert.match(model, /onDelete: Cascade/);
  assert.match(model, /userId/);
  assert.match(model, /shopId/);
  assert.match(model, /@@unique\(\[userId, shopId\]\)/);
});
