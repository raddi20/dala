import assert from "node:assert/strict";
import test from "node:test";
import { mergeFreshItems, occasionTileOrder } from "@/lib/home-fresh";

test("fresh items with a photo come first, then the newest", () => {
  const older = new Date("2026-01-01T00:00:00Z");
  const newer = new Date("2026-06-01T00:00:00Z");
  const merged = mergeFreshItems([
    { id: "b", createdAt: newer, hasPhoto: false },
    { id: "a", createdAt: older, hasPhoto: true },
    { id: "c", createdAt: newer, hasPhoto: true },
    { id: "d", createdAt: newer, hasPhoto: true },
  ]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["c", "d", "a", "b"],
  );
  assert.deepEqual(
    mergeFreshItems(
      [
        { id: "z", createdAt: newer, hasPhoto: true },
        { id: "m", createdAt: newer, hasPhoto: true },
      ],
      1,
    ).map((item) => item.id),
    ["m"],
  );
});

test("occasion tiles keep every slug and do not lead with funerals", () => {
  const ordered = occasionTileOrder([
    { slug: "funerals", title: "Funerals" },
    { slug: "homecomings", title: "Homecomings" },
    { slug: "weddings-dowry", title: "Weddings & dowry (ayie)" },
    { slug: "christmas-at-home", title: "Christmas at home" },
  ]);
  assert.equal(ordered[0]?.slug, "homecomings");
  assert.equal(ordered.at(-1)?.slug, "funerals");
  assert.equal(ordered.length, 4);
  assert.deepEqual(
    occasionTileOrder([{ slug: "weddings-dowry" }, { slug: "homecomings" }]).map((tile) => tile.slug),
    ["weddings-dowry", "homecomings"],
  );
});
