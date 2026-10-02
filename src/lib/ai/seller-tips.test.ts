import assert from "node:assert/strict";
import test from "node:test";
import { handleWeeklyTips } from "@/app/api/ai/cron/weekly-tips/route";
import { checkSellerTips } from "@/lib/ai/prompts/seller-tips";
import {
  ruleTips,
  runWeeklySellerTips,
  sellerStatsJson,
  tipEmailText,
  unsubscribeToken,
  weekStartUtc,
  type TipSeller,
} from "@/lib/ai/seller-tips";

function env(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as unknown as NodeJS.ProcessEnv;
}

const mailEnv = env({
  AI_SELLER_TIPS: "1",
  TIPS_EMAIL: "1",
  ZEPTOMAIL_TOKEN: "zoho-token",
  EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
  CRON_SECRET: "long-secret",
});

const statsJson = sellerStatsJson(
  { listingViews: 12, shopViews: 3, whatsappTaps: 1, callTaps: 0 },
  { listingViews: 4, shopViews: 1, whatsappTaps: 0, callTaps: 0 },
  { missingPhoto: 3, noPrice: 0, shortDescription: 0, noOfferings: 0, noOccasion: 0, listings: 2 },
);

function seller(overrides: Partial<TipSeller> = {}): TipSeller {
  return {
    userId: "user_1",
    email: "amina@example.com",
    name: "Amina",
    storefrontId: "shop_1",
    tipsEmailOptIn: false,
    alreadySent: false,
    statsJson,
    ...overrides,
  };
}

const tip = { title: "Add a photo", body: "12 people viewed the listing.", action: "add_photo" as const };

test("the week starts on Monday 00:00 UTC", () => {
  assert.equal(weekStartUtc(new Date("2026-10-01T12:00:00Z")).toISOString(), "2026-09-28T00:00:00.000Z");
  assert.equal(weekStartUtc(new Date("2026-10-04T23:00:00Z")).toISOString(), "2026-09-28T00:00:00.000Z");
});

test("checklist tips use the seller's own counts", () => {
  const tips = ruleTips({ missingPhoto: 3, noPrice: 0, shortDescription: 0, noOfferings: 0, noOccasion: 1, listings: 4 });
  assert.match(tips.tips[0]?.body ?? "", /3 listings have no photo/);
  assert.equal(tips.tips.some((item) => item.body.includes("999")), false);
});

test("tips that invent a number are dropped", () => {
  const checked = checkSellerTips(
    { summary: "A quiet week.", tips: [tip, { title: "Huge", body: "You had 999 views.", action: "none" }] },
    { statsJson },
  );
  assert.equal(checked.tips.length, 1);
  assert.equal(checked.tips[0]?.title, "Add a photo");
});

test("flags off still purge old stats and do not draft or send", async () => {
  let purged = 0;
  let sends = 0;
  const result = await runWeeklySellerTips({
    now: new Date("2026-10-05T05:00:00Z"),
    env: env({}),
    sellers: [seller({ tipsEmailOptIn: true })],
    purge: async () => {
      purged += 1;
      return 1;
    },
    send: async () => {
      sends += 1;
      return "sent";
    },
  });
  assert.deepEqual(result, { emailed: 0, drafted: 0, reason: "off" });
  assert.equal(purged, 1);
  assert.equal(sends, 0);
});

test("a seller who has not opted in is not emailed", async () => {
  let sends = 0;
  const saved: string[] = [];
  const result = await runWeeklySellerTips({
    now: new Date("2026-10-05T05:00:00Z"),
    env: mailEnv,
    featureOn: async () => true,
    sellers: [seller()],
    purge: async () => 0,
    run: async () => ({
      ok: true,
      data: { summary: "A quiet week.", tips: [tip] },
      provider: "mock",
      model: "mock",
      costMicroUsd: 0,
      latencyMs: 1,
    }),
    send: async () => {
      sends += 1;
      return "sent";
    },
    save: async (row) => {
      saved.push(row.userId);
    },
  });
  assert.deepEqual(result, { emailed: 0, drafted: 1, reason: "ran" });
  assert.equal(sends, 0);
  assert.deepEqual(saved, ["user_1"]);
});

test("an opted-in seller is emailed once, with an unsubscribe link", async () => {
  const mailed: string[] = [];
  const result = await runWeeklySellerTips({
    now: new Date("2026-10-05T05:00:00Z"),
    env: mailEnv,
    origin: "https://rangach.co.ke",
    featureOn: async () => true,
    sellers: [seller({ tipsEmailOptIn: true }), seller({ userId: "user_2", alreadySent: true, tipsEmailOptIn: true })],
    purge: async () => 0,
    run: async () => ({
      ok: true,
      data: { summary: "A quiet week.", tips: [tip] },
      provider: "mock",
      model: "mock",
      costMicroUsd: 0,
      latencyMs: 1,
    }),
    send: async (message) => {
      mailed.push(message.to);
      assert.match(message.text, /Unsubscribe: https:\/\/rangach.co.ke\/api\/ai\/tips-unsubscribe/);
      assert.match(message.text, /does not contact buyers/);
      return "sent";
    },
    save: async () => undefined,
    markEmailed: async () => undefined,
  });
  assert.deepEqual(mailed, ["amina@example.com"]);
  assert.equal(result.emailed, 1);
  const token = unsubscribeToken("user_1", "long-secret");
  assert.equal(tipEmailText("Amina", { summary: "Hi", tips: [] }, "https://rangach.co.ke/x").includes(token), false);
});

test("an empty tip list is not stored or emailed", async () => {
  let sends = 0;
  let saves = 0;
  const result = await runWeeklySellerTips({
    env: mailEnv,
    featureOn: async () => true,
    sellers: [seller({ tipsEmailOptIn: true })],
    purge: async () => 0,
    run: async () => ({
      ok: true,
      data: { summary: "No change this week.", tips: [] },
      provider: "mock",
      model: "mock",
      costMicroUsd: 0,
      latencyMs: 1,
    }),
    send: async () => {
      sends += 1;
      return "sent";
    },
    save: async () => {
      saves += 1;
    },
  });
  assert.equal(result.drafted, 0);
  assert.equal(sends, 0);
  assert.equal(saves, 0);
});

test("the weekly cron rejects a missing secret", async () => {
  const secret = env({ CRON_SECRET: "long-secret" });
  const denied = await handleWeeklyTips(new Request("http://localhost/api/ai/cron/weekly-tips"), { env: secret });
  assert.equal(denied.status, 401);
  const allowed = await handleWeeklyTips(
    new Request("http://localhost/api/ai/cron/weekly-tips", { headers: { authorization: "Bearer long-secret" } }),
    {
      env: secret,
      run: async () => ({ emailed: 0, drafted: 0, reason: "off" }),
    },
  );
  assert.equal(allowed.status, 200);
});
