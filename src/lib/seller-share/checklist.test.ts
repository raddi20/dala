import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVisibilityChecklist,
  checklistProgress,
  marketingKitIncluded,
} from "@/lib/seller-share/checklist";
import { handlesFromShop } from "@/lib/seller-share/handles";
import { buildThankYouMessage, type ThankYouShop } from "@/lib/seller-mail/thank-you";
import { canSendVisibilityEmail, visibilityEmailText } from "@/lib/seller-mail/visibility";
import { buildAllCaptions, coachingTips } from "@/lib/seller-share/captions";

const freeHandles = handlesFromShop({ whatsapp: "+254700000001" });

function freeShopGaps() {
  return {
    published: true,
    bannerUrl: "",
    bio: "Short",
    phone: "+254700000001",
    whatsapp: "+254700000001",
    offerings: [{ imageUrl: "" }],
    listings: [],
    branches: [],
    handles: freeHandles,
    featured: false,
    verifiedPro: false,
  };
}

test("marketing kit is included for every live shop, including free (non-Featured, non-Pro)", () => {
  assert.equal(marketingKitIncluded({ published: true, featured: false, verifiedPro: false }), true);
  assert.equal(marketingKitIncluded({ published: true, featured: true, verifiedPro: true }), true);
  assert.equal(marketingKitIncluded({ published: false, featured: false, verifiedPro: false }), false);
});

test("a free live shop gets the checklist, share captions, coaching, and email copy", () => {
  const input = freeShopGaps();
  assert.equal(marketingKitIncluded(input), true);

  const items = buildVisibilityChecklist(input);
  assert.ok(items.some((item) => item.id === "photos" && item.done === false));
  assert.ok(items.some((item) => item.id === "share"));
  assert.ok(items.every((item) => !/Featured|Verified Pro|upgrade|pay/i.test(item.label + item.hint)));

  const captions = buildAllCaptions(
    {
      kind: "shop",
      name: "Free Kitchen",
      url: "https://www.rangach.co.ke/b/free-kitchen",
      city: "Kisumu",
      description: "Chapati and beans.",
    },
    freeHandles,
  );
  for (const text of Object.values(captions)) {
    assert.match(text, /https:\/\/www\.rangach\.co\.ke\/b\/free-kitchen/);
    assert.match(text, /@rangachke/);
    assert.equal(/Featured|Verified Pro|upgrade to/i.test(text), false);
  }

  const tips = coachingTips(
    {
      kind: "shop",
      name: "Free Kitchen",
      url: "https://www.rangach.co.ke/b/free-kitchen",
    },
    freeHandles,
  );
  assert.ok(tips.length >= 4);
  assert.ok(tips.every((tip) => !/Featured|Verified Pro|pay for/i.test(tip.title + tip.body)));

  const thankYou = buildThankYouMessage({
    storefrontId: "sf-free",
    slug: "free-kitchen",
    shopName: "Free Kitchen",
    email: "free@example.com",
    ownerName: "Amina",
    thankYouEmailSentAt: null,
    published: true,
    wasAlreadyPublished: false,
  } satisfies ThankYouShop, "https://www.rangach.co.ke");
  assert.ok(thankYou);
  assert.match(thankYou!.text, /https:\/\/www\.rangach\.co\.ke\/b\/free-kitchen/);
  assert.equal(/Featured|Verified Pro/i.test(thankYou!.text), false);

  assert.equal(
    canSendVisibilityEmail({
      SELLER_VISIBILITY_EMAIL: "1",
      ZEPTOMAIL_TOKEN: "tok",
      EMAIL_FROM: "Rangach <no-reply@rangach.co.ke>",
    } as unknown as NodeJS.ProcessEnv),
    true,
  );
  assert.match(
    visibilityEmailText({
      name: "Amina",
      shopUrl: "https://www.rangach.co.ke/b/free-kitchen",
      tips: [{ title: "Add photos", body: "1 missing." }],
      unsubscribe: "https://www.rangach.co.ke/u",
    }),
    /Account → Share/,
  );

  const progress = checklistProgress(items);
  assert.equal(progress.total, 4);
  assert.ok(progress.done < progress.total);
});

test("checklist marks complete items for a filled free shop", () => {
  const items = buildVisibilityChecklist({
    published: true,
    bannerUrl: "https://example.com/c.jpg",
    bio: "We cook fish stew and ugali for weekend catering around Kisumu town.",
    phone: "+254700000001",
    whatsapp: "+254700000001",
    offerings: [
      { imageUrl: "https://example.com/1.jpg" },
      { imageUrl: "https://example.com/2.jpg" },
      { imageUrl: "https://example.com/3.jpg" },
    ],
    listings: [],
    branches: [{ hours: "Mon–Sat 9–6", phone: "+254700000001" }],
    handles: handlesFromShop({
      instagramHandle: "@free",
      facebookHandle: "free",
      xHandle: "free",
      tiktokHandle: "@free",
      whatsapp: "+254700000001",
    }),
    featured: false,
    verifiedPro: false,
  });
  assert.equal(items.find((item) => item.id === "photos")?.done, true);
  assert.equal(items.find((item) => item.id === "listings")?.done, true);
  assert.equal(items.find((item) => item.id === "about-hours")?.done, true);
  assert.equal(items.find((item) => item.id === "handles")?.done, true);
});
