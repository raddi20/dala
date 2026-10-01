import assert from "node:assert/strict";
import test from "node:test";
import { canSendTips, cronAuthorized, sendTipEmail } from "@/lib/ai/zeptomail";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as unknown as NodeJS.ProcessEnv;
}

const ready = env({
  TIPS_EMAIL: "1",
  ZEPTOMAIL_TOKEN: "zoho-token",
  EMAIL_FROM: "noreply@example.com",
});

test("tips email stays off unless the flag, token, and from address are all set", () => {
  assert.equal(canSendTips(env({})), false);
  assert.equal(canSendTips(env({ TIPS_EMAIL: "1" })), false);
  assert.equal(canSendTips(env({ TIPS_EMAIL: "1", ZEPTOMAIL_TOKEN: "zoho-token" })), false);
  assert.equal(canSendTips(env({ TIPS_EMAIL: "true", ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "noreply@example.com" })), false);
  assert.equal(canSendTips(ready), true);
});

test("the cron accepts only the bearer secret", () => {
  const blank = new Request("http://localhost/api/cron/seller-tips");
  assert.equal(cronAuthorized(blank, env({})), false);
  assert.equal(cronAuthorized(blank, env({ CRON_SECRET: "long-secret" })), false);
  const wrong = new Request("http://localhost/api/cron/seller-tips", {
    headers: { authorization: "Bearer other" },
  });
  assert.equal(cronAuthorized(wrong, env({ CRON_SECRET: "long-secret" })), false);
  const right = new Request("http://localhost/api/cron/seller-tips", {
    headers: { authorization: "Bearer long-secret" },
  });
  assert.equal(cronAuthorized(right, env({ CRON_SECRET: "long-secret" })), true);
});

test("send is skipped when ZeptoMail is not configured", async () => {
  let calls = 0;
  const result = await sendTipEmail(
    { to: "a@example.com", name: "Amina", subject: "Week", text: "Hello" },
    {
      env: env({}),
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      },
    },
  );
  assert.equal(result, "skipped");
  assert.equal(calls, 0);
});

test("a configured send posts plain text with the ZeptoMail key header", async () => {
  const seen: { url: string; method: string; authorization: string; body: unknown }[] = [];
  const result = await sendTipEmail(
    { to: "a@example.com", name: "Amina", subject: "Your week on Rangach", text: "Hello Amina" },
    {
      env: ready,
      fetchImpl: async (input, init) => {
        seen.push({
          url: String(input),
          method: init?.method ?? "",
          authorization: new Headers(init?.headers).get("authorization") ?? "",
          body: JSON.parse(String(init?.body)),
        });
        return new Response("{}", { status: 201 });
      },
    },
  );
  assert.equal(result, "sent");
  assert.equal(seen.length, 1);
  const call = seen[0];
  assert.ok(call);
  assert.equal(call.url, "https://api.zeptomail.com/v1.1/email");
  assert.equal(call.method, "POST");
  assert.equal(call.authorization, "Zoho-enczapikey zoho-token");
  assert.deepEqual(call.body, {
    from: { address: "noreply@example.com", name: "Rangach" },
    to: [{ email_address: { address: "a@example.com", name: "Amina" } }],
    subject: "Your week on Rangach",
    textbody: "Hello Amina",
  });
});

test("a ZeptoMail error or a thrown fetch is a failed send", async () => {
  const rejected = await sendTipEmail(
    { to: "a@example.com", name: "", subject: "Week", text: "Hello" },
    { env: ready, fetchImpl: async () => new Response("no", { status: 400 }) },
  );
  const thrown = await sendTipEmail(
    { to: "a@example.com", name: "", subject: "Week", text: "Hello" },
    {
      env: ready,
      fetchImpl: async () => {
        throw new Error("network");
      },
    },
  );
  assert.equal(rejected, "failed");
  assert.equal(thrown, "failed");
});
