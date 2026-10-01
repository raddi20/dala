import assert from "node:assert/strict";
import test from "node:test";
import { tapKindForHref, viewKindForPath } from "@/lib/stats/events";
import { STAT_RETENTION_DAYS, statRetentionCutoff } from "@/lib/stats/retention";
import { handleTrack, sessionHash, type StatRow, type StatStore } from "@/lib/stats/track";

function memory() {
  const rows: StatRow[] = [];
  const store: StatStore = {
    async findListing(id) {
      if (id === "hidden") return { id, hidden: true };
      if (id === "missing") return null;
      return { id, hidden: false };
    },
    async findShop(slug) {
      if (slug === "draft") return { id: "shop_draft", published: false };
      if (slug === "missing") return null;
      return { id: `shop_${slug}`, published: true };
    },
    async countRecent(hash, since) {
      return rows.filter((row) => row.sessionHash === hash && row.createdAt >= since).length;
    },
    async hasRecentView(query) {
      return rows.some(
        (row) =>
          row.sessionHash === query.sessionHash &&
          row.kind === query.kind &&
          row.listingId === query.listingId &&
          row.storefrontId === query.storefrontId &&
          row.createdAt >= query.since,
      );
    },
    async insert(row) {
      rows.push(row);
    },
  };
  return { rows, store };
}

const visitor = "visitor1234567890";
const salt = "stats-salt";

function ctx(store: StatStore, now: string, extra?: Partial<{ trackingOn: boolean; userAgent: string; salt: string }>) {
  return {
    trackingOn: extra?.trackingOn ?? true,
    salt: extra?.salt ?? salt,
    userAgent: extra?.userAgent ?? "Mozilla/5.0",
    now: new Date(now),
    store,
  };
}

test("one listing view is stored once and a reload within 30 minutes is ignored", async () => {
  const { rows, store } = memory();
  const first = await handleTrack(
    { kind: "listing_view", path: "/listings/sofa1", visitorId: visitor },
    ctx(store, "2026-10-01T12:00:00Z"),
  );
  const reload = await handleTrack(
    { kind: "listing_view", path: "/listings/sofa1", visitorId: visitor },
    ctx(store, "2026-10-01T12:20:00Z"),
  );
  const later = await handleTrack(
    { kind: "listing_view", path: "/listings/sofa1", visitorId: visitor },
    ctx(store, "2026-10-01T12:31:00Z"),
  );
  assert.equal(first.wrote, true);
  assert.equal(reload.wrote, false);
  assert.equal(later.wrote, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.listingId, "sofa1");
  assert.equal(rows[0]?.kind, "listing_view");
  assert.notEqual(rows[0]?.sessionHash, visitor);
  assert.equal(rows[0]?.sessionHash, sessionHash(salt, visitor));
});

test("a WhatsApp tap on a shop page records the storefront", async () => {
  const { rows, store } = memory();
  const result = await handleTrack(
    { kind: "whatsapp_tap", path: "/b/mama-atieno", visitorId: visitor },
    ctx(store, "2026-10-01T12:00:00Z"),
  );
  assert.equal(result.status, 204);
  assert.equal(result.wrote, true);
  assert.equal(rows[0]?.kind, "whatsapp_tap");
  assert.equal(rows[0]?.storefrontId, "shop_mama-atieno");
  assert.equal(rows[0]?.listingId, "");
  assert.equal(viewKindForPath("/b/mama-atieno"), "shop_view");
  assert.equal(tapKindForHref("https://wa.me/254700000000"), "whatsapp_tap");
  assert.equal(tapKindForHref("tel:+254700000000"), "call_tap");
});

test("the flag off, bots, and the visitor cap write nothing", async () => {
  const { rows, store } = memory();
  const off = await handleTrack({ kind: "listing_view", path: "/listings/sofa1", visitorId: visitor }, ctx(store, "2026-10-01T12:00:00Z", { trackingOn: false }));
  assert.equal(off.status, 204);
  assert.equal(off.wrote, false);
  const bot = await handleTrack(
    { kind: "listing_view", path: "/listings/sofa1", visitorId: visitor },
    ctx(store, "2026-10-01T12:00:00Z", { userAgent: "Googlebot/2.1" }),
  );
  assert.equal(bot.wrote, false);
  for (let i = 0; i < 60; i += 1) {
    await handleTrack(
      { kind: "whatsapp_tap", path: "/b/mama-atieno", visitorId: visitor },
      ctx(store, "2026-10-01T12:00:00Z"),
    );
  }
  const blocked = await handleTrack(
    { kind: "call_tap", path: "/b/mama-atieno", visitorId: visitor },
    ctx(store, "2026-10-01T12:00:30Z"),
  );
  assert.equal(blocked.wrote, false);
  assert.equal(rows.length, 60);
});

test("raw stat events are kept for 180 days", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const cutoff = statRetentionCutoff(now);
  assert.equal(STAT_RETENTION_DAYS, 180);
  assert.equal(cutoff.toISOString(), "2026-04-04T00:00:00.000Z");
});
