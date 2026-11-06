import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAllCaptions,
  buildCaption,
  coachingTips,
  tipCardText,
  type ShareSubject,
} from "@/lib/seller-share/captions";
import { handlesFromShop, missingHandleKeys, normalizeSocialHandle } from "@/lib/seller-share/handles";
import { RANGACH_SOCIALS, rangachSocialLine } from "@/lib/seller-share/rangach-socials";
import { shareCardSvg } from "@/lib/seller-share/card";

const subject: ShareSubject = {
  kind: "shop",
  name: "Amina Kitchen",
  url: "https://www.rangach.co.ke/b/amina-kitchen",
  city: "Nairobi",
  description: "Fish stew and ugali for weekend catering.",
};

const handles = handlesFromShop({
  instagramHandle: "@amina.eats",
  facebookHandle: "https://www.facebook.com/amina.eats",
  xHandle: "amina_eats",
  tiktokHandle: "@amina.eats",
  whatsapp: "+254711111111",
});

test("normalizes handles and lists missing ones", () => {
  assert.equal(normalizeSocialHandle("@Hello", "instagram"), "Hello");
  assert.equal(normalizeSocialHandle("https://www.instagram.com/hello/", "instagram"), "hello");
  assert.equal(normalizeSocialHandle("https://x.com/hello", "x"), "hello");
  assert.deepEqual(missingHandleKeys(handlesFromShop({})), ["instagram", "facebook", "x", "tiktok", "whatsapp"]);
  assert.deepEqual(missingHandleKeys(handles), []);
});

test("every caption includes Rangach URL, seller handles, and Rangach socials", () => {
  const all = buildAllCaptions(subject, handles);
  for (const [target, text] of Object.entries(all)) {
    assert.match(text, /https:\/\/www\.rangach\.co\.ke\/b\/amina-kitchen/, target);
    assert.match(text, /@rangachke/, target);
    assert.match(text, /amina/i, target);
    assert.equal(/invented|fake price|lorem/i.test(text), false, target);
  }
  assert.match(buildCaption("whatsapp", subject, handles), /\+254711111111/);
  assert.match(rangachSocialLine(), new RegExp(RANGACH_SOCIALS.instagram.handle.replace("@", "@")));
});

test("captions use only provided facts", () => {
  const listing: ShareSubject = {
    kind: "listing",
    name: "Room in Kisumu",
    url: "https://www.rangach.co.ke/listings/abc",
    city: "Kisumu",
    priceLabel: "KES 8,000 / month",
    description: "Quiet room near the lake.",
  };
  const text = buildCaption("facebook", listing, handlesFromShop({}));
  assert.match(text, /Room in Kisumu/);
  assert.match(text, /Kisumu/);
  assert.match(text, /KES 8,000 \/ month/);
  assert.match(text, /https:\/\/www\.rangach\.co\.ke\/listings\/abc/);
  assert.equal(text.includes("Nairobi"), false);
});

test("coaching tip cards include URL, seller handles, and Rangach socials", () => {
  const tips = coachingTips(subject, handles);
  assert.ok(tips.some((tip) => tip.id === "film"));
  assert.ok(tips.some((tip) => tip.id === "bio"));
  assert.ok(tips.some((tip) => tip.id === "channels"));
  const card = tipCardText(tips[0]!, subject, handles);
  assert.match(card, /https:\/\/www\.rangach\.co\.ke\/b\/amina-kitchen/);
  assert.match(card, /@amina\.eats|amina\.eats/);
  assert.match(card, /@rangachke/);
});

test("missing handles add a coaching prompt", () => {
  const tips = coachingTips(subject, handlesFromShop({}));
  assert.equal(tips[0]?.id, "handles");
});

test("share card SVG carries name, URL, and Rangach mark", () => {
  const svg = shareCardSvg({
    name: "Amina Kitchen",
    url: "https://www.rangach.co.ke/b/amina-kitchen",
    subtitle: "Nairobi",
  });
  assert.match(svg, /Amina Kitchen/);
  assert.match(svg, /www\.rangach\.co\.ke\/b\/amina-kitchen/);
  assert.match(svg, /Rangach/);
});
