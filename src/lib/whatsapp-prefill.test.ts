import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { UI_STRINGS } from "@/lib/i18n/strings";
import { whatsappChatLink, whatsappFoundYouLink, whatsappFoundYouText, whatsappShopLink } from "@/lib/whatsapp";

const listing = { title: "Fresh tilapia in Nairobi", url: "https://www.rangach.co.ke/listings/abc" };

test("the found-you message names the app, asks if it is still available, and carries title and link", () => {
  assert.equal(
    whatsappFoundYouText(listing),
    "Hi, I found you on Rangach – is this still available? Fresh tilapia in Nairobi https://www.rangach.co.ke/listings/abc",
  );
  assert.equal(whatsappFoundYouText({ title: "", url: "https://x.test/b/fundi" }), "Hi, I found you on Rangach – is this still available? https://x.test/b/fundi");
});

test("the one-tap link is a wa.me link to the seller with the message encoded", () => {
  const link = whatsappFoundYouLink("+254722506974", listing);
  assert.ok(link.startsWith("https://wa.me/254722506974?text="));
  assert.equal(new URL(link).searchParams.get("text"), whatsappFoundYouText(listing));
  assert.equal(whatsappChatLink("+254722506974", listing.title, listing.url), link);
  const shop = whatsappShopLink("+254722506974", "https://www.rangach.co.ke/b/fundi-kisumu", "Fundi in Kisumu");
  assert.match(new URL(shop).searchParams.get("text") ?? "", /is this still available\? Fundi in Kisumu https:\/\/www\.rangach\.co\.ke\/b\/fundi-kisumu$/);
  assert.equal(whatsappFoundYouLink("0722", listing), "");
});

test("the Dholuo prefill is a flagged draft, so Dholuo buyers still get English", () => {
  assert.equal(UI_STRINGS.wa_found_you.draft, true);
  assert.equal(whatsappFoundYouText(listing, "dholuo"), whatsappFoundYouText(listing, "en"));
});

test("listing page, shop page and sticky bar all use the prefilled link", () => {
  const listingPage = readFileSync(new URL("../app/listings/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(listingPage, /whatsappChatLink\(contacts\.whatsapp, listing\.title, listingUrl, lang\)/);
  assert.match(listingPage, /sticky-cta-bar[\s\S]*href=\{chatUrl\}/);
  const shopPage = readFileSync(new URL("../app/b/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(shopPage, /whatsappShopLink\(phone, url, shop\.user\.name, lang\)/);
  assert.match(shopPage, /sticky-cta-bar[\s\S]*href=\{chatUrl\}/);
});
