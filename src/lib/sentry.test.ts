import assert from "node:assert/strict";
import test from "node:test";
import {
  SENTRY_TRACE_SAMPLE_RATE,
  scrubSentryEvent,
  scrubText,
  sentryDsn,
  sentryInitOptions,
  sentrySourceMapsEnabled,
} from "./sentry";

test("sentry is a no-op unless a DSN is set, and source maps need an auth token", () => {
  const previous = {
    dsn: process.env.SENTRY_DSN,
    pub: process.env.NEXT_PUBLIC_SENTRY_DSN,
    token: process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  };
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.SENTRY_AUTH_TOKEN;
  delete process.env.SENTRY_ORG;
  delete process.env.SENTRY_PROJECT;
  assert.equal(sentryDsn(), "");
  assert.equal(sentrySourceMapsEnabled(), false);
  assert.equal(sentryInitOptions().tracesSampleRate, SENTRY_TRACE_SAMPLE_RATE);
  assert.equal(SENTRY_TRACE_SAMPLE_RATE, 0.05);
  assert.equal(sentryInitOptions().dataCollection.userInfo, false);

  process.env.SENTRY_AUTH_TOKEN = "sntrys_test";
  assert.equal(sentrySourceMapsEnabled(), false);
  process.env.SENTRY_ORG = "rangach";
  process.env.SENTRY_PROJECT = "rangach";
  assert.equal(sentrySourceMapsEnabled(), true);

  process.env.SENTRY_DSN = "https://example.ingest.sentry.io/1";
  assert.equal(sentryDsn(), "https://example.ingest.sentry.io/1");
  delete process.env.SENTRY_DSN;
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public.ingest.sentry.io/2";
  assert.equal(sentryDsn(), "https://public.ingest.sentry.io/2");

  for (const [key, value] of Object.entries(previous)) {
    const name =
      key === "dsn"
        ? "SENTRY_DSN"
        : key === "pub"
          ? "NEXT_PUBLIC_SENTRY_DSN"
          : key === "token"
            ? "SENTRY_AUTH_TOKEN"
            : key === "org"
              ? "SENTRY_ORG"
              : "SENTRY_PROJECT";
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("sentry events lose emails and phone numbers", () => {
  assert.equal(scrubText("Write to akinyi@dala.local please"), "Write to [email] please");
  assert.equal(scrubText("Call +254 729 217 350"), "Call [phone]");
  assert.equal(scrubText("WhatsApp 0722506974 or 0722 506 974"), "WhatsApp [phone] or [phone]");
  assert.equal(scrubText("bad number 2547266444175"), "bad number [phone]");
  assert.equal(scrubText("Mama Atieno's Kitchen, KES 1500"), "Mama Atieno's Kitchen, KES 1500");

  const event = scrubSentryEvent({
    message: "reset failed for grace@dala.local",
    user: { id: "user_1", email: "grace@dala.local", ip_address: "102.0.0.1", username: "Grace" },
    request: {
      url: "https://www.rangach.co.ke/login?email=grace@dala.local&next=/listings",
      headers: { cookie: "session=grace@dala.local", "user-agent": "Mozilla" },
      data: { phone: "0722506974", city: "Kisumu" },
    },
    breadcrumbs: [{ message: "tap +254729217350" }],
  });

  const json = JSON.stringify(event);
  assert.equal(json.includes("grace@dala.local"), false);
  assert.equal(json.includes("akinyi@"), false);
  assert.equal(json.includes("0722506974"), false);
  assert.equal(json.includes("254729217350"), false);
  assert.equal(json.includes("102.0.0.1"), false);
  assert.equal(json.includes("[email]"), true);
  assert.equal(json.includes("[phone]"), true);
  assert.equal(json.includes("Kisumu"), true);
  assert.equal(json.includes("Grace"), true);
  assert.equal(json.includes("user_1"), true);
});
