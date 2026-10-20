import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RECENT_MAX,
  cleanIds,
  isSaved,
  mergeSaved,
  missingOnServer,
  parseList,
  pushRecent,
  toggleSaved,
  type SavedItem,
} from "@/lib/saved";

const item = (id: string, at = 0): SavedItem => ({ id, title: `Fundi in Kisumu ${id}`, photo: "", price: "", place: "Kisumu", at });

test("a heart toggles on and off, newest first", () => {
  let list: SavedItem[] = [];
  let step = toggleSaved(list, item("aaaaaaaa1"), 1);
  assert.equal(step.saved, true);
  list = toggleSaved(step.list, item("bbbbbbbb2"), 2).list;
  assert.deepEqual(list.map((row) => row.id), ["bbbbbbbb2", "aaaaaaaa1"]);
  step = toggleSaved(list, item("aaaaaaaa1"), 3);
  assert.equal(step.saved, false);
  assert.equal(isSaved(step.list, "aaaaaaaa1"), false);
});

test("recently viewed moves a repeat to the front and caps the strip", () => {
  let list: SavedItem[] = [];
  for (let i = 0; i < RECENT_MAX + 5; i++) list = pushRecent(list, item(`listing${String(i).padStart(3, "0")}`), i);
  assert.equal(list.length, RECENT_MAX);
  list = pushRecent(list, item("listing010"), 99);
  assert.equal(list[0].id, "listing010");
  assert.equal(list.filter((row) => row.id === "listing010").length, 1);
});

test("tampered or broken storage never crashes and drops bad rows", () => {
  assert.deepEqual(parseList("not json", 10), []);
  assert.deepEqual(parseList('{"id":"x"}', 10), []);
  const rows = parseList(
    JSON.stringify([item("goodid001"), { id: "<script>" }, item("goodid001"), { ...item("goodid002"), photo: "javascript:alert(1)" }]),
    10,
  );
  assert.deepEqual(rows.map((row) => row.id), ["goodid001", "goodid002"]);
  assert.equal(rows[1].photo, "");
  assert.deepEqual(cleanIds(["goodid001", 5, "../etc", "goodid001"]), ["goodid001"]);
});

test("signing in merges the phone's hearts with the account's", () => {
  const local = [item("localonly1", 5), item("bothsides1", 1)];
  const server = [{ ...item("bothsides1", 3), title: "Fresh tilapia in Nairobi" }, item("serveronly", 2)];
  const merged = mergeSaved(local, server);
  assert.deepEqual(merged.map((row) => row.id), ["localonly1", "bothsides1", "serveronly"]);
  assert.equal(merged[1].title, "Fresh tilapia in Nairobi");
  assert.deepEqual(missingOnServer(local, ["bothsides1"]), ["localonly1"]);
});

test("schema is additive: a new SavedListing table and no change to existing models", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const block = schema.split("model SavedListing {")[1]?.split("}")[0] ?? "";
  assert.match(block, /@@unique\(\[userId, listingId\]\)/);
  assert.doesNotMatch(block, /@relation/);
});

test("cards, the listing page, home and the header wire up Saved", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../components/listing-card.tsx"), /saveId=\{listing\.id\}/);
  assert.match(read("../components/item-card.tsx"), /<SaveHeart/);
  const page = read("../app/listings/[id]/page.tsx");
  assert.match(page, /<SaveHeart variant="page"/);
  assert.match(page, /<TrackRecent/);
  assert.match(read("../app/page.tsx"), /<RecentlyViewedStrip \/>/);
  assert.match(read("../components/header.tsx"), /href="\/saved"/);
  const api = read("../app/api/saved/route.ts");
  assert.match(api, /status: 401/);
  assert.match(api, /hidden: false, owner: liveOwner/);
});
