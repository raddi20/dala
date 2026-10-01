import assert from "node:assert/strict";
import test from "node:test";
import { handleSellerTipsCron } from "@/app/api/cron/seller-tips/route";
import { checkSellerTips, sellerTipsPrompt } from "@/lib/ai/prompts/seller-tips";
import { runAi } from "@/lib/ai/run";
import { runWeeklySellerTips, sellerStatsJson, tipEmailText, weekStartUtc, type TipSeller } from "@/lib/ai/seller-tips";
import type { AIProvider, GenerateRequest, GenerateResult } from "@/lib/ai/types";
import type { UsageStore } from "@/lib/ai/usage";

function env(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as unknown as NodeJS.ProcessEnv;
}

const mailEnv = env({
  AI_SELLER_TIPS: "1",
  TIPS_EMAIL: "1",
  ZEPTOMAIL_TOKEN: "zoho-token",
  EMAIL_FROM: "noreply@example.com",
});

function seller(overrides: Partial<TipSeller> = {}): TipSeller {
  return {
    userId: "user_1",
    email: "amina@example.com",
    name: "Amina",
    listingViews: 12,
    shopViews: 3,
    whatsappTaps: 1,
    callTaps: 0,
    listingCount: 2,
    alreadySent: false,
    ...overrides,
  };
}

const tip = {
  title: "Add a photo",
  body: "12 people viewed the listing.",
  action: "add_photo" as const,
};

test("the week starts on Monday in UTC", () => {
  assert.equal(weekStartUtc(new Date("2026-10-01T12:00:00Z")), "2026-09-28");
  assert.equal(weekStartUtc(new Date("2026-10-04T23:00:00Z")), "2026-09-28");
  assert.equal(weekStartUtc(new Date("2026-09-28T00:00:00Z")), "2026-09-28");
});

test("a tip email is plain text about the seller's own page", () => {
  const text = tipEmailText("Amina", { summary: "A quiet week.", tips: [tip] });
  assert.match(text, /^Hello Amina,/);
  assert.match(text, /A quiet week\./);
  assert.match(text, /Add a photo: 12 people viewed the listing\./);
  assert.match(text, /does not contact buyers/);
  assert.match(tipEmailText("  ", { summary: "A quiet week.", tips: [] }), /^Hello,/);
});

test("tips that invent a number, or a second upgrade, are dropped", () => {
  const statsJson = sellerStatsJson(seller());
  const checked = checkSellerTips(
    {
      summary: "A quiet week.",
      tips: [
        tip,
        { title: "Huge week", body: "You had 999 views.", action: "none" },
        { title: "Featured", body: "Views are up.", action: "upgrade_featured" },
        { title: "Featured again", body: "Still up.", action: "upgrade_featured" },
      ],
    },
    { statsJson },
  );
  assert.equal(checked.tips.length, 2);
  assert.equal(checked.tips[0]?.title, "Add a photo");
  assert.equal(checked.tips[1]?.action, "upgrade_featured");
  assert.equal(statsJson.includes("999"), false);
});

test("flags off still purge old stats and do not draft or send", async () => {
  let purged = 0;
  let runs = 0;
  let sends = 0;
  const result = await runWeeklySellerTips({
    now: new Date("2026-10-05T06:00:00Z"),
    env: env({}),
    sellers: [seller()],
    purge: async () => {
      purged += 1;
      return 4;
    },
    run: async () => {
      runs += 1;
      return { ok: true, data: { summary: "Hi", tips: [tip] }, provider: "mock", model: "mock", costMicroUsd: 0, latencyMs: 1 };
    },
    send: async () => {
      sends += 1;
      return "sent";
    },
  });
  assert.deepEqual(result, { emailed: 0, drafted: 0, reason: "off" });
  assert.equal(purged, 1);
  assert.equal(runs, 0);
  assert.equal(sends, 0);
});

test("a missing mail flag does not call the model", async () => {
  let runs = 0;
  const result = await runWeeklySellerTips({
    env: env({ AI_SELLER_TIPS: "1" }),
    featureOn: async () => true,
    sellers: [seller()],
    purge: async () => 0,
    run: async () => {
      runs += 1;
      return { ok: true, data: { summary: "Hi", tips: [tip] }, provider: "mock", model: "mock", costMicroUsd: 0, latencyMs: 1 };
    },
  });
  assert.deepEqual(result, { emailed: 0, drafted: 0, reason: "email_off" });
  assert.equal(runs, 0);
});

test("an empty tip list is not emailed", async () => {
  let sends = 0;
  const result = await runWeeklySellerTips({
    env: mailEnv,
    featureOn: async () => true,
    sellers: [seller()],
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
  });
  assert.deepEqual(result, { emailed: 0, drafted: 0, reason: "ran" });
  assert.equal(sends, 0);
});

test("a failed send is not recorded, so a later run can retry", async () => {
  const saved: string[] = [];
  const result = await runWeeklySellerTips({
    now: new Date("2026-10-05T06:00:00Z"),
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
    send: async () => "failed",
    save: async (row) => {
      saved.push(row.userId);
    },
  });
  assert.deepEqual(result, { emailed: 0, drafted: 1, reason: "ran" });
  assert.deepEqual(saved, []);
});

test("a successful send is stored once and a seller already mailed is skipped", async () => {
  const saved: { userId: string; weekStart: string }[] = [];
  const mailed: string[] = [];
  const result = await runWeeklySellerTips({
    now: new Date("2026-10-05T06:00:00Z"),
    env: mailEnv,
    featureOn: async () => true,
    sellers: [seller(), seller({ userId: "user_2", email: "boo@example.com", alreadySent: true })],
    purge: async () => 0,
    run: async (_spec, _input, actor) => {
      assert.equal(actor?.userId, "user_1");
      return {
        ok: true,
        data: { summary: "A quiet week.", tips: [tip] },
        provider: "mock",
        model: "mock",
        costMicroUsd: 0,
        latencyMs: 1,
      };
    },
    send: async (message) => {
      mailed.push(message.to);
      assert.match(message.text, /does not contact buyers/);
      return "sent";
    },
    save: async (row) => {
      saved.push({ userId: row.userId, weekStart: row.weekStart });
    },
  });
  assert.deepEqual(result, { emailed: 1, drafted: 1, reason: "ran" });
  assert.deepEqual(mailed, ["amina@example.com"]);
  assert.deepEqual(saved, [{ userId: "user_1", weekStart: "2026-10-05" }]);
});

test("numbers the model invents never reach the email", async () => {
  const store: UsageStore = {
    async write() {},
    async monthSpendMicro() {
      return 0;
    },
    async countSince() {
      return 0;
    },
  };
  const model: AIProvider = {
    name: "mock",
    supportsImages: () => false,
    async generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      assert.match(req.text, /"listingViews":12/);
      return {
        data: {
          summary: "A quiet week.",
          tips: [{ title: "Huge week", body: "You had 999 views.", action: "none" }],
        } as T,
        usage: { inputTokens: 10, outputTokens: 10 },
        costMicroUsd: 0,
        provider: "mock",
        model: "mock",
        latencyMs: 1,
      };
    },
  };
  let sends = 0;
  const result = await runWeeklySellerTips({
    env: mailEnv,
    featureOn: async () => true,
    sellers: [seller()],
    purge: async () => 0,
    run: (spec, input, actor, runDeps) =>
      runAi(spec, input, actor, {
        ...runDeps,
        config: {
          disabled: false,
          disabledReason: null,
          warnings: [],
          provider: "mock",
          geminiApiKey: "",
          openaiApiKey: "",
          compatBaseUrl: "",
          compatApiKey: "",
          compatVision: false,
          compatJsonMode: "json_schema",
          priceInPerM: 0,
          priceOutPerM: 0,
          modelPrimary: "mock",
          modelFast: "mock",
          modelOverrides: {},
          fallback: null,
          timeoutMs: 8000,
          maxRetries: 0,
          monthlyBudgetUsd: 10,
          mockMode: "ok",
        },
        store,
        providers: { mock: model },
        featureOn: async () => true,
      }),
    send: async () => {
      sends += 1;
      return "sent";
    },
  });
  assert.equal(sellerTipsPrompt.postCheck?.name, "checkSellerTips");
  assert.deepEqual(result, { emailed: 0, drafted: 0, reason: "ran" });
  assert.equal(sends, 0);
});

test("the cron route rejects a missing secret and runs when the bearer matches", async () => {
  const secret = env({ CRON_SECRET: "long-secret" });
  const denied = await handleSellerTipsCron(new Request("http://localhost/api/cron/seller-tips"), { env: secret });
  assert.equal(denied.status, 401);
  let ran = 0;
  const allowed = await handleSellerTipsCron(
    new Request("http://localhost/api/cron/seller-tips", { headers: { authorization: "Bearer long-secret" } }),
    {
      env: secret,
      run: async () => {
        ran += 1;
        return { emailed: 0, drafted: 0, reason: "off" };
      },
    },
  );
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { emailed: 0, drafted: 0, reason: "off" });
  assert.equal(ran, 1);
});
