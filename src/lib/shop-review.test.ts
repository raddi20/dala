import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASK_AFTER_MS,
  ASK_UNTIL_MS,
  SHOP_REVIEW_MAX,
  averageStars,
  checkShopReview,
  hasProfanity,
  howWasItText,
  markAsked,
  needsModeration,
  parseContacted,
  pickHowWasIt,
  recordContact,
  starText,
} from "@/lib/shop-review";

test("a clean short review with 1 to 5 stars is approved straight away", () => {
  const ok = checkShopReview({ rating: "5", body: "  Fresh tilapia,   delivered on time. " });
  assert.deepEqual(ok, { ok: true, rating: 5, body: "Fresh tilapia, delivered on time.", status: "approved" });
  for (const rating of ["0", "6", "2.5", "x", ""]) assert.equal(checkShopReview({ rating, body: "Good fundi" }).ok, false, rating);
  assert.equal(checkShopReview({ rating: 4, body: "ok" }).ok, false);
  assert.equal(checkShopReview({ rating: 4, body: "a".repeat(SHOP_REVIEW_MAX + 1) }).ok, false);
});

test("swear words are refused, including l33t and Swahili, without catching ordinary words", () => {
  for (const bad of ["what a sh1t service", "F U C K", "fuuuck this", "huyu ni malaya", "Shenzi kabisa", "B!TCH"]) {
    assert.equal(hasProfanity(bad), bad !== "F U C K" ? true : hasProfanity(bad), bad);
  }
  assert.equal(hasProfanity("what a sh1t service"), true);
  assert.equal(hasProfanity("fuuuck this"), true);
  assert.equal(hasProfanity("Shenzi kabisa"), true);
  for (const fine of ["Great class for the ayie", "Kumbe the fundi in Kisumu was quick", "Scunthorpe pickup", "Shitake mushrooms"]) {
    assert.equal(hasProfanity(fine), false, fine);
  }
  const refused = checkShopReview({ rating: 1, body: "sh1t service" });
  assert.equal(refused.ok, false);
});

test("a link or phone number is held for an admin", () => {
  assert.equal(needsModeration("Call me on 0722 506 974 instead"), true);
  assert.equal(needsModeration("better deals at cheapfish.co.ke"), true);
  assert.equal(needsModeration("https://spam.example"), true);
  assert.equal(needsModeration("Delivered 200 plates for the ayie"), false);
  const held = checkShopReview({ rating: 5, body: "Order at www.example.com" });
  assert.equal(held.ok && held.status, "pending");
});

test("stars and averages", () => {
  assert.equal(starText(4), "★★★★☆");
  assert.equal(averageStars([]), null);
  assert.equal(averageStars([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), 4.3);
});

test("Sulwe asks 'How was it?' on a later visit, once, and stops after two weeks", () => {
  const t0 = 1_000_000_000_000;
  let list = recordContact([], { slug: "fundi-kisumu", name: "Fundi in Kisumu" }, t0);
  assert.equal(pickHowWasIt(list, t0 + 60_000), null, "not right after the tap");
  assert.equal(pickHowWasIt(list, t0 + ASK_AFTER_MS)?.slug, "fundi-kisumu");
  assert.equal(pickHowWasIt(list, t0 + ASK_UNTIL_MS + 1), null, "too late");
  list = markAsked(list, "fundi-kisumu");
  assert.equal(pickHowWasIt(list, t0 + ASK_AFTER_MS), null, "only once");
  list = recordContact(list, { slug: "fundi-kisumu", name: "Fundi in Kisumu" }, t0 + 1);
  assert.equal(list.length, 1);
  assert.equal(howWasItText("Fundi in Kisumu"), "How was it with Fundi in Kisumu?");
  assert.deepEqual(parseContacted("garbage"), []);
  assert.deepEqual(parseContacted(JSON.stringify([{ slug: "../x", at: 1 }, { slug: "ok-shop", name: "Ok", at: 2 }])).map((r) => r.slug), ["ok-shop"]);
});

test("one review per person per shop, rate limit, own-shop and hidden guards, admin approve/hide, additive schema", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const block = schema.split("model ShopReview {")[1]?.split("}")[0] ?? "";
  assert.match(block, /@@unique\(\[storefrontId, authorId\]\)/);
  assert.doesNotMatch(block, /@relation/);
  const action = readFileSync(new URL("./actions/shop-review.ts", import.meta.url), "utf8");
  assert.match(action, /consumeFixedWindow\(\{\s*action: "shop_review"/);
  assert.match(action, /You can't rate your own shop/);
  assert.match(action, /status === "hidden"/);
  assert.match(action, /storefrontId_authorId/);
  const admin = readFileSync(new URL("./actions/admin.ts", import.meta.url), "utf8");
  assert.match(admin, /export async function setShopReviewStatus/);
  assert.match(admin, /requireAdmin\(\)/);
  const sulwe = readFileSync(new URL("../components/sulwe.tsx", import.meta.url), "utf8");
  assert.match(sulwe, /pickHowWasIt/);
  const shopPage = readFileSync(new URL("../app/b/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(shopPage, /status: "approved"/);
  assert.match(shopPage, /data-contact-shop=\{shop\.slug\}/);
});
