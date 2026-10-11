import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { POST } from "@/app/api/errors/route";
import nextConfig from "../../next.config";
import { CLIENT_ERROR_LIMIT, takeClientErrorSlot, type MemoryBucket } from "./rate-limit";
import { CLIENT_ERROR_BODY_LIMIT, parseClientErrorReport } from "./client-error-report";

test("client error reports drop emails and phones and reject junk", () => {
  const parsed = parseClientErrorReport(
    JSON.stringify({
      message: "reset failed for grace@dala.local",
      stack: "Error: call +254 729 217 350\n    at page",
      digest: "abc123",
      href: "https://www.rangach.co.ke/login?email=grace@dala.local",
      cookie: "session=secret",
      email: "grace@dala.local",
    }),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const json = JSON.stringify(parsed.report);
  assert.equal(json.includes("grace@dala.local"), false);
  assert.equal(json.includes("254 729 217 350"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(parsed.report.digest, "abc123");
  assert.match(parsed.report.message, /\[email\]/);
  assert.match(parsed.report.stack, /\[phone\]/);

  assert.equal(parseClientErrorReport("not-json").ok, false);
  assert.equal(parseClientErrorReport("[]").ok, false);
  assert.equal(parseClientErrorReport(JSON.stringify({ message: "" })).ok, false);
  const oversized = parseClientErrorReport("x".repeat(CLIENT_ERROR_BODY_LIMIT + 1));
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.status, 413);
});

test("the browser reporter and client hook do not import the Sentry SDK", () => {
  for (const file of ["report-error.ts", "../instrumentation-client.ts", "../app/error.tsx", "../app/global-error.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.equal(source.includes("@sentry/nextjs"), false, file);
    assert.equal(source.includes("NEXT_PUBLIC_SENTRY_DSN"), false, file);
  }
  const stub = readFileSync(new URL("./sentry-client-stub.ts", import.meta.url), "utf8");
  assert.equal(stub.includes("from \"@sentry/nextjs\""), false);
});

test("browser bundles alias @sentry/nextjs to the stub", () => {
  const alias = nextConfig.turbopack?.resolveAlias?.["@sentry/nextjs"];
  assert.ok(alias && typeof alias === "object" && !Array.isArray(alias));
  assert.equal(alias.browser, "./src/lib/sentry-client-stub.ts");
  assert.equal(typeof nextConfig.webpack, "function");
});

test("client error reports allow 30 per minute and hash the IP", async () => {
  const memory = new Map<string, MemoryBucket>();
  const ip = "203.0.113.50";
  const now = 1_700_000_000_000;
  for (let i = 0; i < CLIENT_ERROR_LIMIT; i += 1) {
    const hit = await takeClientErrorSlot(ip, { now, memory, durable: null });
    assert.equal(hit.limited, false);
    assert.equal(hit.key.includes(ip), false);
    assert.match(hit.key, /^client_error:[a-f0-9]{64}:/);
  }
  const blocked = await takeClientErrorSlot(ip, { now, memory, durable: null });
  assert.equal(blocked.limited, true);
  const later = await takeClientErrorSlot(ip, { now: now + 60_000, memory, durable: null });
  assert.equal(later.limited, false);
});

test("the error route rejects bodies over 16 KB and drops reports when no DSN is set", async () => {
  const tooBig = await POST(
    new Request("http://localhost/api/errors", {
      method: "POST",
      headers: { "content-length": String(CLIENT_ERROR_BODY_LIMIT + 1) },
      body: "x",
    }),
  );
  assert.equal(tooBig.status, 413);

  const fat = await POST(
    new Request("http://localhost/api/errors", {
      method: "POST",
      body: "y".repeat(CLIENT_ERROR_BODY_LIMIT + 1),
    }),
  );
  assert.equal(fat.status, 413);

  const previous = {
    dsn: process.env.SENTRY_DSN,
    pub: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  try {
    const response = await POST(
      new Request("http://localhost/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "grace@dala.local broke it", stack: "0722506974" }),
      }),
    );
    assert.equal(response.status, 204);
  } finally {
    if (previous.dsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = previous.dsn;
    if (previous.pub === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = previous.pub;
  }
});
