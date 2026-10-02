import assert from "node:assert/strict";
import test from "node:test";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { canSendTips, parseEmailFrom, sendTipEmail } from "@/lib/email/zeptomail";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as unknown as NodeJS.ProcessEnv;
}

const ready = env({
  TIPS_EMAIL: "1",
  ZEPTOMAIL_TOKEN: "zoho-token",
  EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
});

test("tips email stays off unless the flag, token, and from address are all set", () => {
  assert.equal(canSendTips(env({})), false);
  assert.equal(canSendTips(env({ TIPS_EMAIL: "1", ZEPTOMAIL_TOKEN: "zoho-token" })), false);
  assert.deepEqual(parseEmailFrom("Rangach <hello@rangach.co.ke>"), {
    address: "hello@rangach.co.ke",
    name: "Rangach",
  });
  assert.equal(canSendTips(ready), true);
});

test("the cron accepts only the bearer secret", () => {
  const blank = new Request("http://localhost/api/ai/cron/weekly-tips");
  assert.equal(cronAuthorized(blank, env({})), false);
  const right = new Request("http://localhost/api/ai/cron/weekly-tips", {
    headers: { authorization: "Bearer long-secret" },
  });
  assert.equal(cronAuthorized(right, env({ CRON_SECRET: "long-secret" })), true);
  assert.equal(cronAuthorized(right, env({ CRON_SECRET: "other" })), false);
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
  const seen: { authorization: string; body: { from: { address: string; name: string }; textbody: string } }[] = [];
  const result = await sendTipEmail(
    { to: "a@example.com", name: "Amina", subject: "Your week on Rangach", text: "Hello Amina" },
    {
      env: ready,
      fetchImpl: async (_input, init) => {
        seen.push({
          authorization: new Headers(init?.headers).get("authorization") ?? "",
          body: JSON.parse(String(init?.body)),
        });
        return new Response("{}", { status: 201 });
      },
    },
  );
  assert.equal(result, "sent");
  assert.equal(seen[0]?.authorization, "Zoho-enczapikey zoho-token");
  assert.equal(seen[0]?.body.from.address, "hello@rangach.co.ke");
  assert.equal(seen[0]?.body.from.name, "Rangach");
  assert.equal(seen[0]?.body.textbody, "Hello Amina");
});
