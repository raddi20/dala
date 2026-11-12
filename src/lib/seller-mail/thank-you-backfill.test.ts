import assert from "node:assert/strict";
import test from "node:test";
import { handleThankYouBackfill } from "@/app/api/seller/cron/thank-you-backfill/route";
import {
  backfillThankYouEmailText,
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

test("backfill keeps the go-live thank-you and adds the marketing note", () => {
  const message = buildBackfillThankYouMessage(shop(), "https://www.rangach.co.ke");
  assert.ok(message);
  assert.equal(message!.subject, "Your Rangach shop is live");
  const goLive = thankYouEmailText({
    ownerName: "Amina",
    shopName: "Amina Kitchen",
    shopUrl: "https://www.rangach.co.ke/b/amina-kitchen",
  });
  // Go-live template for brand-new shops stays unchanged (no Share & promote pitch).
  assert.equal(/account\/share|visibility checklist|weekly tip/i.test(goLive), false);
  assert.match(message!.text, /Your shop Amina Kitchen is live on Rangach/);
  assert.match(message!.text, /https:\/\/www\.rangach\.co\.ke\/b\/amina-kitchen/);
  assert.match(message!.text, /https:\/\/www\.rangach\.co\.ke\/account\/share/);
  assert.match(message!.text, /https:\/\/www\.rangach\.co\.ke\/account/);
  assert.match(message!.text, /Share & promote/);
  assert.match(message!.text, /@rangachke/);
  assert.match(message!.text, /visibility checklist/);
  assert.match(message!.text, /unsubscribe/);
  assert.match(message!.text, /You post yourself/);
  assert.match(message!.text, /How to use it:/);
  assert.match(message!.text, /Pick WhatsApp, Instagram, Facebook, X, or TikTok/);
  assert.match(message!.text, /Copy the ready caption/);
  assert.match(message!.text, /branded card/);
  assert.match(message!.text, /post from your own account/);
  assert.equal(
    message!.text,
    backfillThankYouEmailText({
      ownerName: "Amina",
      shopName: "Amina Kitchen",
      shopUrl: "https://www.rangach.co.ke/b/amina-kitchen",
      origin: "https://www.rangach.co.ke",
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
      assert.match(message.text, /Share & promote/);
      assert.match(message.text, /visibility checklist/);
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

function cronEnv(secret: string | undefined): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  if (secret !== undefined) env.CRON_SECRET = secret;
  return env as unknown as NodeJS.ProcessEnv;
}

test("valid bearer runs without x-vercel-cron or once=1", async () => {
  const env = cronEnv("secret");
  let runs = 0;
  const run = async () => {
    runs += 1;
    return { emailed: 0, skipped: 0, already: 0, failed: 0, eligible: 0 };
  };

  const response = await handleThankYouBackfill(
    new Request("https://www.rangach.co.ke/api/seller/cron/thank-you-backfill", {
      method: "GET",
      headers: { authorization: "Bearer secret" },
    }),
    { env, run },
  );
  assert.equal(response.status, 200);
  const json = (await response.json()) as { tipEmails?: number; error?: string };
  assert.equal(json.tipEmails, 0);
  assert.equal(json.error, undefined);
  assert.equal(runs, 1);

  const manual = await handleThankYouBackfill(
    new Request("https://www.rangach.co.ke/api/seller/cron/thank-you-backfill?once=1", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
    }),
    { env, run },
  );
  assert.equal(manual.status, 200);
  assert.equal(runs, 2);

  assert.equal(
    thankYouBackfillOnceFlag(
      new Request("https://example.com/x", {
        headers: { authorization: "Bearer secret" },
      }),
      null,
      env,
    ),
    true,
  );
  assert.equal(
    thankYouBackfillOnceFlag(new Request("https://example.com/x", { method: "POST" }), { once: 1 }),
    true,
  );
  assert.equal(
    thankYouBackfillOnceFlag(new Request("https://example.com/x?once=1"), null),
    true,
  );
});

test("real Vercel cron GET with bearer proceeds without x-vercel-cron", async () => {
  const env = cronEnv("secret");
  let runs = 0;
  const run = async () => {
    runs += 1;
    return { emailed: 0, skipped: 0, already: 0, failed: 0, eligible: 0 };
  };

  const response = await handleThankYouBackfill(
    new Request("https://www.rangach.co.ke/api/seller/cron/thank-you-backfill", {
      method: "GET",
      headers: {
        authorization: "Bearer secret",
        "user-agent": "vercel-cron/1.0",
        "x-vercel-cron-schedule": "0 * * * *",
      },
    }),
    { env, run },
  );
  assert.equal(response.status, 200);
  assert.equal(runs, 1);
  const json = (await response.json()) as { tipEmails?: number };
  assert.equal(json.tipEmails, 0);
});

test("cron header or user-agent never authorizes, and a bad bearer is rejected", async () => {
  const env = cronEnv("secret");
  let runs = 0;
  const run = async () => {
    runs += 1;
    return { emailed: 0, skipped: 0, already: 0, failed: 0, eligible: 0 };
  };
  const url = "https://www.rangach.co.ke/api/seller/cron/thank-you-backfill";
  const spoof = {
    "user-agent": "vercel-cron/1.0",
    "x-vercel-cron": "1",
    "x-vercel-cron-schedule": "0 * * * *",
  };

  const cases: Array<{ headers: Record<string, string>; env: NodeJS.ProcessEnv; method?: string; query?: string; body?: string }> = [
    { headers: { "x-vercel-cron": "1" }, env },
    { headers: { "user-agent": "vercel-cron/1.0" }, env },
    { headers: spoof, env },
    { headers: { ...spoof, authorization: "Bearer wrong" }, env },
    { headers: { ...spoof, authorization: "Bearer secret" }, env: cronEnv(undefined) },
    { headers: { ...spoof, authorization: "Bearer secret" }, env: cronEnv("") },
    { headers: { ...spoof, authorization: "Bearer " }, env: cronEnv("   ") },
    { headers: { authorization: "Bearer secret", "x-vercel-cron": "1" }, env: cronEnv(undefined) },
    { headers: { ...spoof }, env, query: "?once=1" },
    { headers: { ...spoof, authorization: "Bearer wrong" }, env, query: "?once=1" },
    {
      headers: { ...spoof, "content-type": "application/json" },
      env,
      method: "POST",
      body: JSON.stringify({ once: 1 }),
    },
  ];

  for (const entry of cases) {
    const response = await handleThankYouBackfill(
      new Request(`${url}${entry.query ?? ""}`, {
        method: entry.method ?? "GET",
        headers: entry.headers,
        body: entry.body,
      }),
      { env: entry.env, run },
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }
  assert.equal(runs, 0);

  assert.equal(
    thankYouBackfillOnceFlag(
      new Request("https://example.com/x", {
        headers: { "x-vercel-cron": "1", "user-agent": "vercel-cron/1.0" },
      }),
      null,
    ),
    false,
  );
  assert.equal(
    thankYouBackfillOnceFlag(
      new Request("https://example.com/x", {
        headers: { authorization: "Bearer wrong", "x-vercel-cron": "1", "user-agent": "vercel-cron/1.0" },
      }),
      null,
      env,
    ),
    false,
  );
});

test("already-thanked shop is skipped and the mailer is not called", async () => {
  const mailed: string[] = [];
  let marks = 0;
  const result = await runThankYouBackfill({
    now: new Date("2026-11-12T13:00:00Z"),
    origin: "https://www.rangach.co.ke",
    candidates: [
      shop({
        storefrontId: "done",
        email: "done@example.com",
        slug: "done",
        thankYouEmailSentAt: new Date("2026-11-01T00:00:00Z"),
      }),
    ],
    markSent: async () => {
      marks += 1;
      return true;
    },
    clearSent: async () => {
      throw new Error("clearSent should not run");
    },
    send: async (message) => {
      mailed.push(message.to);
      return "sent";
    },
  });

  assert.equal(result.emailed, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.already, 0);
  assert.equal(result.failed, 0);
  assert.equal(marks, 0);
  assert.deepEqual(mailed, []);
});
