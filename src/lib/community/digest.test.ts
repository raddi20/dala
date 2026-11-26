import assert from "node:assert/strict";
import test from "node:test";
import { digestEmailText, digestShops, shouldEmailDigest, weekStart, type DigestRecipient } from "@/lib/community/digest";
import { messagesForDigest } from "@/lib/community/send-digest";

const now = new Date("2026-11-25T06:00:00.000Z");
const since = weekStart(now);
const fresh = new Date("2026-11-24T08:00:00.000Z");
const old = new Date("2026-10-01T08:00:00.000Z");

function person(overrides: Partial<DigestRecipient> = {}): DigestRecipient {
  return {
    userId: "buyer",
    email: "achieng@example.com",
    name: "Achieng",
    optOut: false,
    suspended: false,
    shops: [
      {
        name: "Nyangoma Fresh Fish",
        slug: "nyangoma-fish",
        ownerEmail: "nyangoma@example.com",
        updates: [{ body: "Omena is in. Come by before noon.", createdAt: fresh }],
        listings: [{ id: "tilapia", title: "Whole tilapia, this morning", createdAt: fresh }],
      },
    ],
    ...overrides,
  };
}

test("the digest keeps this week's news and drops demo shops and quiet weeks", () => {
  const shops = digestShops(
    [
      ...person().shops,
      {
        name: "Mama Atieno",
        slug: "mama-atieno",
        ownerEmail: "atieno@dala.local",
        updates: [{ body: "Demo fish", createdAt: fresh }],
        listings: [],
      },
      {
        name: "Quiet Grocer",
        slug: "quiet",
        ownerEmail: "quiet@example.com",
        updates: [{ body: "Old note", createdAt: old }],
        listings: [],
      },
    ],
    since,
  );
  assert.equal(shops.length, 1);
  assert.equal(shops[0]?.slug, "nyangoma-fish");
  assert.equal(shouldEmailDigest(person(), since), true);
  assert.equal(shouldEmailDigest(person({ optOut: true }), since), false);
  assert.equal(shouldEmailDigest(person({ email: "james@dala.local" }), since), false);
  assert.equal(shouldEmailDigest(person({ shops: [] }), since), false);
});

test("the Monday note is plain text with the shop, the listing, and one unsubscribe link", () => {
  const text = digestEmailText({
    name: "Achieng",
    shops: digestShops(person().shops, since),
    origin: "https://www.rangach.co.ke",
    unsubscribe: "https://www.rangach.co.ke/api/community/digest-unsubscribe?user=buyer&token=abc",
  });
  assert.match(text, /Hello Achieng/);
  assert.match(text, /Nyangoma Fresh Fish/);
  assert.match(text, /Omena is in/);
  assert.match(text, /https:\/\/www\.rangach\.co\.ke\/b\/nyangoma-fish/);
  assert.match(text, /New listing: Whole tilapia, this morning/);
  assert.match(text, /https:\/\/www\.rangach\.co\.ke\/listings\/tilapia/);
  assert.match(text, /Stop these notes:/);
  assert.equal(text.split("Stop these notes:").length, 2);
  const messages = messagesForDigest([person(), person({ userId: "quiet", email: "quiet@example.com", shops: [] })], now, "https://www.rangach.co.ke", "secret");
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.subject, "New from shops you follow");
  assert.match(messages[0]?.text ?? "", /token=/);
});
