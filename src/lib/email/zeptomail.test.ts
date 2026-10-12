import assert from "node:assert/strict";
import test from "node:test";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { readFileSync } from "node:fs";
import { canSendMail, canSendTips, deliverMail, parseEmailFrom, sendMail, sendTipEmail } from "@/lib/email/zeptomail";

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

test("password reset mail uses the ZeptoMail token and from address, and does not need TIPS_EMAIL", async () => {
  assert.equal(canSendMail(env({})), false);
  assert.equal(canSendTips(env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" })), false);
  assert.equal(canSendMail(env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" })), true);
  let calls = 0;
  const sent = await sendMail(
    { to: "a@example.com", name: "Amina", subject: "Reset your Rangach password", text: "Hello" },
    {
      env: env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" }),
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 201 });
      },
    },
  );
  assert.equal(sent, "sent");
  assert.equal(calls, 1);
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

test("mail posts to the EU ZeptoMail URL by default", async () => {
  let url = "";
  const result = await sendMail(
    { to: "a@example.com", name: "Amina", subject: "Reset your Rangach password", text: "Hello" },
    {
      env: env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" }),
      fetchImpl: async (input) => {
        url = String(input);
        return new Response("{}", { status: 201 });
      },
    },
  );
  assert.equal(result, "sent");
  assert.equal(url, "https://api.zeptomail.eu/v1.1/email");
});

test("ZEPTOMAIL_API_URL overrides the ZeptoMail send URL", async () => {
  let url = "";
  const result = await sendMail(
    { to: "a@example.com", name: "Amina", subject: "Reset your Rangach password", text: "Hello" },
    {
      env: env({
        ZEPTOMAIL_TOKEN: "zoho-token",
        EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
        ZEPTOMAIL_API_URL: " https://api.zeptomail.com/v1.1/email ",
      }),
      fetchImpl: async (input) => {
        url = String(input);
        return new Response("{}", { status: 201 });
      },
    },
  );
  assert.equal(result, "sent");
  assert.equal(url, "https://api.zeptomail.com/v1.1/email");
});

test("a leading Zoho-enczapikey prefix is stripped before the Authorization header", async () => {
  const stored = [
    "plain-token",
    "Zoho-enczapikey plain-token",
    "zoho-enczapikey plain-token",
    "  Zoho-enczapikey    plain-token  ",
  ];
  const seen: string[] = [];
  for (const token of stored) {
    await sendMail(
      { to: "a@example.com", name: "Amina", subject: "Reset your Rangach password", text: "Hello" },
      {
        env: env({ ZEPTOMAIL_TOKEN: token, EMAIL_FROM: "Rangach <hello@rangach.co.ke>" }),
        fetchImpl: async (_input, init) => {
          seen.push(new Headers(init?.headers).get("authorization") ?? "");
          return new Response("{}", { status: 201 });
        },
      },
    );
  }
  assert.deepEqual(seen, [
    "Zoho-enczapikey plain-token",
    "Zoho-enczapikey plain-token",
    "Zoho-enczapikey plain-token",
    "Zoho-enczapikey plain-token",
  ]);
});

test("a non-2xx ZeptoMail response logs the status and body without the token", async () => {
  const token = "zepto-secret-token-9f3a";
  const errors: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  let authorization = "";
  try {
    const result = await sendMail(
      { to: "a@example.com", name: "Amina", subject: "Reset your Rangach password", text: "Hello" },
      {
        env: env({
          ZEPTOMAIL_TOKEN: `Zoho-enczapikey ${token}`,
          EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
        }),
        fetchImpl: async (_input, init) => {
          authorization = new Headers(init?.headers).get("authorization") ?? "";
          const body = `rejected token=${token} ${"e".repeat(2500)}TAIL_NOT_LOGGED`;
          return new Response(body, { status: 401 });
        },
      },
    );
    assert.equal(result, "failed");
  } finally {
    console.error = original;
  }
  assert.equal(authorization, `Zoho-enczapikey ${token}`);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.[0], "ZeptoMail send failed");
  assert.equal(errors[0]?.[1], 401);
  const loggedBody = String(errors[0]?.[2]);
  assert.match(loggedBody, /^rejected token=\[redacted\] /);
  assert.equal(loggedBody.length <= 2048, true);
  assert.equal(loggedBody.includes("TAIL_NOT_LOGGED"), false);
  const dumped = JSON.stringify(errors);
  assert.equal(dumped.includes(token), false);
  assert.equal(dumped.toLowerCase().includes("zoho-enczapikey"), false);
  assert.equal(dumped.includes("Authorization"), false);
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

function spyLogs() {
  const seen = { warn: [] as unknown[][], info: [] as unknown[][], error: [] as unknown[][] };
  const originals = { warn: console.warn, info: console.info, error: console.error };
  console.warn = (...args: unknown[]) => {
    seen.warn.push(args);
  };
  console.info = (...args: unknown[]) => {
    seen.info.push(args);
  };
  console.error = (...args: unknown[]) => {
    seen.error.push(args);
  };
  return {
    seen,
    restore() {
      console.warn = originals.warn;
      console.info = originals.info;
      console.error = originals.error;
    },
  };
}

test("a skipped send names each missing setting and does not print the values", async () => {
  const logs = spyLogs();
  const token = "super-secret-token";
  try {
    const both = await sendMail(
      { to: "a@example.com", name: "Amina", subject: "Reset", text: "Hello" },
      { env: env({}), fetchImpl: async () => new Response("{}", { status: 201 }) },
    );
    const fromOnly = await sendMail(
      { to: "a@example.com", name: "Amina", subject: "Reset", text: "Hello" },
      {
        env: env({ ZEPTOMAIL_TOKEN: token, EMAIL_FROM: "not-an-email" }),
        fetchImpl: async () => new Response("{}", { status: 201 }),
      },
    );
    assert.equal(both, "skipped");
    assert.equal(fromOnly, "skipped");
  } finally {
    logs.restore();
  }
  const dumped = JSON.stringify(logs.seen.warn);
  assert.match(dumped, /ZEPTOMAIL_TOKEN missing/);
  assert.match(dumped, /EMAIL_FROM missing\/invalid \(no @\)/);
  assert.equal(dumped.includes(token), false);
  assert.equal(dumped.includes("not-an-email"), false);
  assert.equal(logs.seen.info.length, 0);
  assert.equal(logs.seen.error.length, 0);
});

test("a send logs the endpoint and sent or failed status", async () => {
  const logs = spyLogs();
  try {
    const sent = await deliverMail(
      { to: "a@example.com", name: "Amina", subject: "Reset", text: "Hello" },
      {
        env: env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" }),
        fetchImpl: async () => new Response('{"message":"OK"}', { status: 201 }),
      },
    );
    const failed = await deliverMail(
      { to: "a@example.com", name: "Amina", subject: "Reset", text: "Hello" },
      {
        env: env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" }),
        fetchImpl: async () => new Response('{"error":"no"}', { status: 403 }),
      },
    );
    assert.equal(sent.result, "sent");
    assert.equal(sent.status, 201);
    assert.equal(sent.endpoint, "https://api.zeptomail.eu/v1.1/email");
    assert.equal(sent.body, '{"message":"OK"}');
    assert.equal(failed.result, "failed");
    assert.equal(failed.status, 403);
    assert.equal(failed.body, '{"error":"no"}');
  } finally {
    logs.restore();
  }
  assert.deepEqual(logs.seen.info, [
    ["ZeptoMail https://api.zeptomail.eu/v1.1/email sent 201"],
    ["ZeptoMail https://api.zeptomail.eu/v1.1/email failed 403"],
  ]);
});

test("a network error logs the error name, message, and endpoint host without the token", async () => {
  const logs = spyLogs();
  const token = "zepto-secret-token-9f3a";
  try {
    const result = await sendMail(
      { to: "a@example.com", name: "Amina", subject: "Reset", text: "Hello" },
      {
        env: env({
          ZEPTOMAIL_TOKEN: `Zoho-enczapikey ${token}`,
          EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
        }),
        fetchImpl: async () => {
          throw new TypeError(`connect ECONNREFUSED ${token}`);
        },
      },
    );
    assert.equal(result, "failed");
  } finally {
    logs.restore();
  }
  assert.deepEqual(logs.seen.error, [["ZeptoMail send failed", "TypeError", "connect ECONNREFUSED [redacted]", "api.zeptomail.eu"]]);
  assert.deepEqual(logs.seen.info, [["ZeptoMail https://api.zeptomail.eu/v1.1/email failed"]]);
  const dumped = JSON.stringify(logs.seen);
  assert.equal(dumped.includes(token), false);
  assert.equal(dumped.toLowerCase().includes("zoho-enczapikey"), false);
});

test("tips that are switched off name TIPS_EMAIL and do not call ZeptoMail", async () => {
  const logs = spyLogs();
  let calls = 0;
  try {
    const result = await sendTipEmail(
      { to: "a@example.com", name: "Amina", subject: "Week", text: "Hello" },
      {
        env: env({ ZEPTOMAIL_TOKEN: "zoho-token", EMAIL_FROM: "Rangach <hello@rangach.co.ke>" }),
        fetchImpl: async () => {
          calls += 1;
          return new Response("{}", { status: 201 });
        },
      },
    );
    assert.equal(result, "skipped");
    assert.equal(calls, 0);
  } finally {
    logs.restore();
  }
  assert.deepEqual(logs.seen.warn, [["ZeptoMail skipped: TIPS_EMAIL off"]]);
});

test("the admin test email is admin-only and shows the ZeptoMail result", () => {
  const action = readFileSync(new URL("../actions/admin-mail.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");
  const widget = readFileSync(new URL("../../components/admin-mail-test.tsx", import.meta.url), "utf8");
  const body = action.slice(action.indexOf("export async function sendAdminTestEmail"));
  assert.match(body, /await requireAdmin\(\)/);
  assert.equal(body.indexOf("requireAdmin") < body.indexOf("deliverMail"), true);
  assert.match(page, /AdminMailTest/);
  assert.match(widget, /Send test email/);
  assert.match(widget, /Endpoint/);
  assert.match(widget, /HTTP status/);
  assert.match(widget, /Response body/);
});
