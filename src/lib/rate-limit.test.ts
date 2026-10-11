import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { RESET_EMAIL_LIMIT, RESET_WINDOW_MS } from "@/lib/password-reset";
import {
  LOGIN_LIMIT,
  LOGIN_LIMIT_MESSAGE,
  LOGIN_WINDOW_MS,
  REGISTER_LIMIT,
  REGISTER_LIMIT_MESSAGE,
  REPORT_LIMIT,
  REPORT_LIMIT_MESSAGE,
  REVIEW_LIMIT,
  REVIEW_LIMIT_MESSAGE,
  SUSPENDED_MESSAGE,
  consumeFixedWindow,
  hashSubject,
  limitPasswordReset,
  rateBucketKey,
  upstashRestConfig,
  type FixedWindowStore,
  type MemoryBucket,
} from "@/lib/rate-limit";

function memoryStore() {
  const rows = new Map<string, number>();
  const store: FixedWindowStore = {
    async increment(key) {
      const next = (rows.get(key) ?? 0) + 1;
      rows.set(key, next);
      return next;
    },
    async cleanup() {},
  };
  return { rows, store };
}

test("a rate-limit key hashes the subject and does not keep a raw IP or email", () => {
  const ip = "203.0.113.44";
  const email = "amina@example.com";
  const key = rateBucketKey("login", `${ip}\n${email}`, 1_700_000_000_000);
  assert.equal(key.startsWith("login:"), true);
  assert.equal(key.includes(ip), false);
  assert.equal(key.includes(email), false);
  assert.equal(key.includes(hashSubject(`${ip}\n${email}`)), true);
});

test("the fixed window blocks after the limit and opens again on the next window", async () => {
  const memory = new Map<string, MemoryBucket>();
  const { store } = memoryStore();
  const subject = "203.0.113.8\nuser@example.com";
  const windowMs = 1_000;
  const now = 5_000;
  for (let i = 0; i < 2; i += 1) {
    const hit = await consumeFixedWindow({
      action: "login",
      subject,
      limit: 2,
      windowMs,
      now: now + i,
      memory,
      durable: store,
    });
    assert.equal(hit.limited, false);
    assert.equal(hit.key.includes("203.0.113.8"), false);
  }
  const blocked = await consumeFixedWindow({
    action: "login",
    subject,
    limit: 2,
    windowMs,
    now: now + 10,
    memory,
    durable: store,
  });
  assert.equal(blocked.limited, true);
  const next = await consumeFixedWindow({
    action: "login",
    subject,
    limit: 2,
    windowMs,
    now: now + windowMs,
    memory,
    durable: store,
  });
  assert.equal(next.limited, false);
  assert.notEqual(next.key, blocked.key);
});

test("in-memory blocks a burst even when the durable store is still under the limit", async () => {
  const memory = new Map<string, MemoryBucket>();
  let durableCalls = 0;
  const store: FixedWindowStore = {
    async increment() {
      durableCalls += 1;
      return 1;
    },
    async cleanup() {},
  };
  let last = false;
  for (let i = 0; i < LOGIN_LIMIT + 1; i += 1) {
    const hit = await consumeFixedWindow({
      action: "login",
      subject: "198.51.100.2\none@example.com",
      limit: LOGIN_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
      now: 10_000,
      memory,
      durable: store,
    });
    last = hit.limited;
  }
  assert.equal(last, true);
  assert.equal(durableCalls, LOGIN_LIMIT + 1);
});

test("friendly messages name the wait, and Upstash is off unless both variables are set", () => {
  assert.match(LOGIN_LIMIT_MESSAGE, /15 minutes/);
  assert.match(REGISTER_LIMIT_MESSAGE, /hour/);
  assert.match(REPORT_LIMIT_MESSAGE, /tomorrow/);
  assert.match(REVIEW_LIMIT_MESSAGE, /tomorrow/);
  assert.match(SUSPENDED_MESSAGE, /suspended/);
  assert.equal(REGISTER_LIMIT, 5);
  assert.equal(REPORT_LIMIT, 10);
  assert.equal(REVIEW_LIMIT, 5);
  assert.equal(upstashRestConfig({}), null);
  assert.equal(upstashRestConfig({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io" }), null);
  assert.deepEqual(upstashRestConfig({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io/", UPSTASH_REDIS_REST_TOKEN: "tok" }), {
    url: "https://example.upstash.io",
    token: "tok",
  });
});

test("password reset uses the same email and IP limits on the shared store", async () => {
  const slots = new Map<string, number[]>();
  const { rows, store } = memoryStore();
  const now = Date.UTC(2026, 9, 11, 8, 0, 0);
  for (let i = 0; i < RESET_EMAIL_LIMIT; i += 1) {
    assert.equal(await limitPasswordReset("amina@example.com", "203.0.113.5", now + i, { memory: slots, durable: store }), false);
  }
  assert.equal(await limitPasswordReset("amina@example.com", "203.0.113.9", now + 20, { memory: slots, durable: store }), true);
  const stored = [...rows.keys()];
  assert.equal(stored.some((key) => key.includes("203.0.113")), false);
  assert.equal(stored.some((key) => key.includes("amina@")), false);
  assert.equal(stored.some((key) => key.startsWith("password_reset_email:")), true);
  assert.ok(RESET_WINDOW_MS > 0);
});

test("the database bucket stores a hash, not the raw IP", async () => {
  const ip = "203.0.113.77";
  const action = `login-test-${Date.now()}`;
  const hit = await consumeFixedWindow({
    action,
    subject: `${ip}\ntester@example.com`,
    limit: 2,
    windowMs: 60_000,
    now: Date.now(),
    memory: new Map(),
    durable: undefined,
  });
  try {
    assert.equal(hit.key.includes(ip), false);
    const row = await prisma.rateLimitBucket.findUnique({ where: { key: hit.key } });
    assert.ok(row);
    assert.equal(row.key.includes(ip), false);
    assert.equal(row.count >= 1, true);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: action } } });
  }
});
