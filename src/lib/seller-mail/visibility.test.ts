import assert from "node:assert/strict";
import test from "node:test";
import { computeShopGaps, gapTips, shopLooksComplete, visibilityDue } from "@/lib/seller-mail/gaps";
import { visibilityUnsubscribeToken } from "@/lib/seller-mail/unsubscribe";
import {
  canSendVisibilityEmail,
  runVisibilityTips,
  visibilityEmailText,
  type VisibilitySeller,
  VISIBILITY_SELLER_CAP,
} from "@/lib/seller-mail/visibility";
import { shouldSkipSellerEmail } from "@/lib/seller-mail/demo";

test("demo and no-email shops are skipped", () => {
  assert.equal(shouldSkipSellerEmail({ email: "x@dala.local", shopName: "Real" }), true);
  assert.equal(shouldSkipSellerEmail({ email: "a@example.com", shopName: "Okello & Co Solicitors" }), true);
  assert.equal(shouldSkipSellerEmail({ email: "", shopName: "Real" }), true);
  assert.equal(shouldSkipSellerEmail({ email: "a@example.com", shopName: "Amina Kitchen" }), false);
});

test("gaps drive weekly vs monthly cadence", () => {
  const now = new Date("2026-11-06T06:00:00Z");
  assert.equal(visibilityDue({ now, lastSentAt: null, complete: false }), true);
  assert.equal(
    visibilityDue({ now, lastSentAt: new Date("2026-11-05T06:00:00Z"), complete: false }),
    false,
  );
  assert.equal(
    visibilityDue({ now, lastSentAt: new Date("2026-10-29T06:00:00Z"), complete: false }),
    true,
  );
  assert.equal(
    visibilityDue({ now, lastSentAt: new Date("2026-10-20T06:00:00Z"), complete: true }),
    false,
  );
  assert.equal(
    visibilityDue({ now, lastSentAt: new Date("2026-10-01T06:00:00Z"), complete: true }),
    true,
  );
});

test("complete shops ease off; incomplete stay weekly", () => {
  const gaps = computeShopGaps({
    bannerUrl: "https://example.com/c.jpg",
    bio: "We cook fish stew and ugali for events around Nairobi every weekend.",
    phone: "+254700000000",
    whatsapp: "",
    offerings: [
      { imageUrl: "https://example.com/1.jpg" },
      { imageUrl: "https://example.com/2.jpg" },
      { imageUrl: "https://example.com/3.jpg" },
    ],
    listings: [],
    branches: [{ hours: "Mon–Sat 9–6", phone: "+254700000000" }],
    hasSocialHandle: true,
  });
  assert.equal(shopLooksComplete(gaps), true);
  assert.ok(gapTips(gaps).some((tip) => /Share your Rangach link/.test(tip.title)));
});

test("unsubscribe is honored and flag gates sending", async () => {
  assert.equal(canSendVisibilityEmail({} as unknown as NodeJS.ProcessEnv), false);
  assert.equal(
    canSendVisibilityEmail({
      SELLER_VISIBILITY_EMAIL: "1",
      ZEPTOMAIL_TOKEN: "tok",
      EMAIL_FROM: "Rangach <no-reply@rangach.co.ke>",
    } as unknown as NodeJS.ProcessEnv),
    true,
  );

  const seller: VisibilitySeller = {
    userId: "u1",
    storefrontId: "s1",
    email: "amina@example.com",
    name: "Amina",
    slug: "amina",
    optOut: true,
    lastSentAt: null,
    gaps: computeShopGaps({
      bannerUrl: "",
      bio: "",
      phone: "",
      whatsapp: "",
      offerings: [],
      listings: [],
      branches: [],
      hasSocialHandle: false,
    }),
  };

  let sends = 0;
  const optedOut = await runVisibilityTips({
    now: new Date("2026-11-06T06:00:00Z"),
    env: {
      SELLER_VISIBILITY_EMAIL: "1",
      ZEPTOMAIL_TOKEN: "tok",
      EMAIL_FROM: "Rangach <no-reply@rangach.co.ke>",
      CRON_SECRET: "secret",
    } as unknown as NodeJS.ProcessEnv,
    origin: "https://www.rangach.co.ke",
    sellers: [seller],
    send: async () => {
      sends += 1;
      return "sent";
    },
  });
  assert.equal(optedOut.emailed, 0);
  assert.equal(sends, 0);

  const mailed: string[] = [];
  const result = await runVisibilityTips({
    now: new Date("2026-11-06T06:00:00Z"),
    env: {
      SELLER_VISIBILITY_EMAIL: "1",
      ZEPTOMAIL_TOKEN: "tok",
      EMAIL_FROM: "Rangach <no-reply@rangach.co.ke>",
      CRON_SECRET: "secret",
    } as unknown as NodeJS.ProcessEnv,
    origin: "https://www.rangach.co.ke",
    sellers: [{ ...seller, optOut: false }],
    send: async (message) => {
      mailed.push(message.text);
      assert.match(message.text, /Unsubscribe: https:\/\/www\.rangach\.co\.ke\/api\/seller\/visibility-unsubscribe/);
      assert.match(message.text, /https:\/\/www\.rangach\.co\.ke\/b\/amina/);
      return "sent";
    },
    markSent: async () => undefined,
  });
  assert.equal(result.emailed, 1);
  assert.equal(mailed.length, 1);
  assert.equal(VISIBILITY_SELLER_CAP > 0, true);
  assert.match(
    visibilityEmailText({
      name: "Amina",
      shopUrl: "https://www.rangach.co.ke/b/amina",
      tips: [{ title: "Add photos", body: "2 missing." }],
      unsubscribe: "https://www.rangach.co.ke/u",
    }),
    /Account → Share/,
  );
  assert.equal(visibilityUnsubscribeToken("u1", "secret").length > 20, true);
});
