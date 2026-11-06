import assert from "node:assert/strict";
import test from "node:test";
import { handleThankYouBackfill } from "@/app/api/seller/cron/thank-you-backfill/route";
import {
  buildBackfillThankYouMessage,
  isEligibleForThankYouBackfill,
  runThankYouBackfill,
  thankYouBackfillOnceFlag,
  type BackfillCandidate,
} from "@/lib/seller-mail/thank-you-backfill";
import { thankYouEmailText } from "@/lib/seller-mail/thank-you";

function shop(overrides: Partial<BackfillCandidate> = {}): BackfillCandidate {
  return {
    storefrontId: "sf1",
    slug: "amina-kitchen",
    shopName: "Amina Kitchen",
    email: "amina@example.com",
    ownerName: "Amina",
    thankYouEmailSentAt: null,
    published: true,
    wasAlreadyPublished: true,
    ...overrides,
  };
}

test("backfill uses the same thank-you template as go-live", () => {
  const message = buildBackfillThankYouMessage(shop(), "https://www.rangach.co.ke");
  assert.ok(message);
  assert.equal(message!.subject, "Your Rangach shop is live");
  assert.equal(
    message!.text,
    thankYouEmailText({
      ownerName: "Amina",
      shopName: "Amina Kitchen",
      shopUrl: "https://www.rangach.co.ke/b/amina-kitchen",
    }),
  );
});

test("skips demo shops, missing email, unpublished, and already-sent", () => {
  assert.equal(isEligibleForThankYouBackfill(shop({ email: "x@dala.local" })), false);
  assert.equal(isEligibleForThankYouBackfill(shop({ shopName: "Mama Atieno's Kitchen" })), false);
  assert.equal(isEligibleForThankYouBackfill(shop({ shopName: "Okello & Co" })), false);
  assert.equal(isEligibleForThankYouBackfill(shop({ shopName: "Peckham Grocer" })), false);
  assert.equal(isEligibleForThankYouBackfill(shop({ email: "" })), false);
  assert.equal(isEligibleForThankYouBackfill(shop({ published: false })), false);
  assert.equal(
    isEligibleForThankYouBackfill(shop({ thankYouEmailSentAt: new Date("2026-11-06T00:00:00Z") })),
    false,
  );
  assert.equal(isEligibleForThankYouBackfill(shop()), true);
});

test("sends to eligible live shops and a second run sends zero", async () => {
  const sent = new Set<string>();
  const mailed: string[] = [];
  const candidates = [
    shop({ storefrontId: "a", email: "a@example.com", slug: "a" }),
    shop({ storefrontId: "demo", email: "d@dala.local", slug: "demo", shopName: "Mama Atieno" }),
    shop({ storefrontId: "b", email: "b@example.com", slug: "b", shopName: "B Shop" }),
    shop({
      storefrontId: "done",
      email: "done@example.com",
      slug: "done",
      thankYouEmailSentAt: new Date("2026-11-01T00:00:00Z"),
    }),
  ];

  const first = await runThankYouBackfill({
    now: new Date("2026-11-06T18:00:00Z"),
    origin: "https://www.rangach.co.ke",
    candidates,
    markSent: async (id) => {
      if (sent.has(id)) return false;
      sent.add(id);
      return true;
    },
    clearSent: async (id) => {
      sent.delete(id);
    },
    send: async (message) => {
      mailed.push(message.to);
      assert.match(message.text, /Your Rangach shop is live|Your shop .+ is live on Rangach/);
      assert.match(message.text, /https:\/\/www\.rangach\.co\.ke\/b\//);
      assert.equal(/visibility|weekly tip|Account → Share for ready captions/i.test(message.text), false);
      return "sent";
    },
  });

  assert.equal(first.emailed, 2);
  assert.deepEqual(mailed.sort(), ["a@example.com", "b@example.com"]);
  assert.ok(first.skipped + first.already >= 1);

  const secondMail: string[] = [];
  const second = await runThankYouBackfill({
    now: new Date("2026-11-06T18:05:00Z"),
    origin: "https://www.rangach.co.ke",
    candidates: candidates.map((row) =>
      sent.has(row.storefrontId)
        ? { ...row, thankYouEmailSentAt: new Date("2026-11-06T18:00:00Z") }
        : row,
    ),
    markSent: async (id) => {
      if (sent.has(id)) return false;
      sent.add(id);
      return true;
    },
    send: async (message) => {
      secondMail.push(message.to);
      return "sent";
    },
  });

  assert.equal(second.emailed, 0);
  assert.deepEqual(secondMail, []);
});

test("backfill never fires visibility tip emails", async () => {
  const tipCalls = 0;
  const result = await runThankYouBackfill({
    candidates: [shop()],
    markSent: async () => true,
    send: async () => "sent",
  });
  assert.equal(result.emailed, 1);
  assert.equal(tipCalls, 0);
});

test("route requires CRON_SECRET and once=1", async () => {
  const env = { CRON_SECRET: "secret" } as unknown as NodeJS.ProcessEnv;
  let runs = 0;
  const run = async () => {
    runs += 1;
    return { emailed: 0, skipped: 0, already: 0, failed: 0, eligible: 0 };
  };

  const unauthorized = await handleThankYouBackfill(
    new Request("https://www.rangach.co.ke/api/seller/cron/thank-you-backfill?once=1", {
      headers: { authorization: "Bearer wrong" },
    }),
    { env, run },
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(runs, 0);

  const missingOnce = await handleThankYouBackfill(
    new Request("https://www.rangach.co.ke/api/seller/cron/thank-you-backfill", {
      headers: { authorization: "Bearer secret" },
    }),
    { env, run },
  );
  assert.equal(missingOnce.status, 400);
  assert.equal(runs, 0);

  const ok = await handleThankYouBackfill(
    new Request("https://www.rangach.co.ke/api/seller/cron/thank-you-backfill?once=1", {
      headers: { authorization: "Bearer secret" },
    }),
    { env, run },
  );
  assert.equal(ok.status, 200);
  const json = (await ok.json()) as { tipEmails?: number };
  assert.equal(json.tipEmails, 0);
  assert.equal(runs, 1);

  assert.equal(
    thankYouBackfillOnceFlag(
      new Request("https://example.com/x", { method: "POST" }),
      { once: 1 },
    ),
    true,
  );
});
