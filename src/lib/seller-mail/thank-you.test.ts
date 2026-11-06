import assert from "node:assert/strict";
import test from "node:test";
import { buildThankYouMessage, maybeSendShopThankYou, thankYouEmailText, type ThankYouShop } from "@/lib/seller-mail/thank-you";

function shop(overrides: Partial<ThankYouShop> = {}): ThankYouShop {
  return {
    storefrontId: "sf1",
    slug: "amina-kitchen",
    shopName: "Amina Kitchen",
    email: "amina@example.com",
    ownerName: "Amina",
    thankYouEmailSentAt: null,
    published: true,
    wasAlreadyPublished: false,
    ...overrides,
  };
}

test("thank-you text includes shop URL and three next steps", () => {
  const text = thankYouEmailText({
    ownerName: "Amina",
    shopName: "Amina Kitchen",
    shopUrl: "https://www.rangach.co.ke/b/amina-kitchen",
  });
  assert.match(text, /https:\/\/www\.rangach\.co\.ke\/b\/amina-kitchen/);
  assert.match(text, /Add clear photos/);
  assert.match(text, /Add a few listings/);
  assert.match(text, /Share your shop link/);
});

test("skips demo shops and missing email", () => {
  assert.equal(buildThankYouMessage(shop({ email: "mama@dala.local" })), null);
  assert.equal(buildThankYouMessage(shop({ shopName: "Mama Atieno's Kitchen" })), null);
  assert.equal(buildThankYouMessage(shop({ email: "" })), null);
  assert.equal(buildThankYouMessage(shop({ email: "nope" })), null);
});

test("does not back-send to shops that were already live", () => {
  assert.equal(buildThankYouMessage(shop({ wasAlreadyPublished: true })), null);
});

test("skips when thank-you already sent", () => {
  assert.equal(buildThankYouMessage(shop({ thankYouEmailSentAt: new Date("2026-11-01T00:00:00Z") })), null);
});

test("idempotent send claims once", async () => {
  let sends = 0;
  let claimed = false;
  const first = await maybeSendShopThankYou("sf1", {
    now: new Date("2026-11-06T12:00:00Z"),
    origin: "https://www.rangach.co.ke",
    load: async () => shop(),
    markSent: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    send: async (message) => {
      sends += 1;
      assert.match(message.text, /https:\/\/www\.rangach\.co\.ke\/b\/amina-kitchen/);
      return "sent";
    },
  });
  const second = await maybeSendShopThankYou("sf1", {
    load: async () => shop({ thankYouEmailSentAt: new Date("2026-11-06T12:00:00Z") }),
    markSent: async () => false,
    send: async () => {
      sends += 1;
      return "sent";
    },
  });
  assert.equal(first, "sent");
  assert.equal(second, "already");
  assert.equal(sends, 1);
});
