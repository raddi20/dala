import { createHash } from "node:crypto";
import { CONTACT_EMAIL } from "@/lib/public-info";
import { RESET_EMAIL_LIMIT, RESET_IP_LIMIT, RESET_WINDOW_MS, takeResetSlot } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

/** Login attempts per IP and email together. */
export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** New accounts per IP. */
export const REGISTER_LIMIT = 5;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;

/** Reports per signed-in user. */
export const REPORT_LIMIT = 10;
export const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Reviews per signed-in user. */
export const REVIEW_LIMIT = 5;
export const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Browser crash reports per hashed IP. */
export const CLIENT_ERROR_LIMIT = 30;
export const CLIENT_ERROR_WINDOW_MS = 60 * 1000;

/** Send-home waitlist sign-ups per hashed IP. */
export const DIASPORA_WAITLIST_LIMIT = 5;
export const DIASPORA_WAITLIST_WINDOW_MS = 60 * 60 * 1000;

export const LOGIN_LIMIT_MESSAGE = "Too many sign-in attempts. Wait 15 minutes and try again.";
export const REGISTER_LIMIT_MESSAGE = "Too many new accounts from this connection. Wait an hour and try again.";
export const REPORT_LIMIT_MESSAGE = "You've sent enough reports for today. Try again tomorrow.";
export const REVIEW_LIMIT_MESSAGE = "You've posted enough reviews for today. Try again tomorrow.";
export const SUSPENDED_MESSAGE = `This account is suspended. Write to ${CONTACT_EMAIL} if you think that's a mistake.`;

const CLEANUP_EVERY_MS = 60 * 60 * 1000;
const KEEP_MS = 2 * 24 * 60 * 60 * 1000;

export type MemoryBucket = { count: number; windowStart: number };

export type FixedWindowStore = {
  increment(key: string, windowStart: Date): Promise<number>;
  cleanup(before: Date): Promise<void>;
};

const memoryBuckets = new Map<string, MemoryBucket>();
let lastCleanup = 0;

export function hashSubject(subject: string): string {
  return createHash("sha256").update(subject).digest("hex");
}

/** Stored key. The subject is hashed, so a raw IP or email is not in it. */
export function rateBucketKey(action: string, subject: string, windowStart: number): string {
  return `${action}:${hashSubject(subject)}:${windowStart}`;
}

export function upstashRestConfig(
  env: Record<string, string | undefined> = process.env,
): { url: string; token: string } | null {
  const url = (env.UPSTASH_REDIS_REST_URL ?? "").trim().replace(/\/$/, "");
  const token = (env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  if (!url || !token) return null;
  return { url, token };
}

export function prismaRateLimitStore(): FixedWindowStore {
  return {
    async increment(key, windowStart) {
      try {
        const row = await prisma.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, windowStart },
          update: { count: { increment: 1 } },
        });
        return row.count;
      } catch {
        const row = await prisma.rateLimitBucket.update({
          where: { key },
          data: { count: { increment: 1 } },
        });
        return row.count;
      }
    },
    async cleanup(before) {
      await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: before } } });
    },
  };
}

export function upstashRateLimitStore(config: { url: string; token: string }, windowMs: number): FixedWindowStore {
  return {
    async increment(key) {
      const response = await fetch(`${config.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, String(windowMs), "NX"],
        ]),
      });
      if (!response.ok) throw new Error(`Upstash responded ${response.status}`);
      const payload = (await response.json()) as unknown;
      const count = upstashCount(payload);
      if (count === null) throw new Error("Upstash increment failed");
      return count;
    },
    async cleanup() {
      // Redis expires each key on its own.
    },
  };
}

function upstashCount(payload: unknown): number | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0];
  if (typeof first === "number") return first;
  if (first && typeof first === "object" && "result" in first) {
    const result = (first as { result?: unknown }).result;
    return typeof result === "number" ? result : null;
  }
  return null;
}

function defaultDurable(windowMs: number): FixedWindowStore {
  const upstash = upstashRestConfig();
  if (upstash) return upstashRateLimitStore(upstash, windowMs);
  return prismaRateLimitStore();
}

function bumpMemory(
  store: Map<string, MemoryBucket>,
  key: string,
  windowStart: number,
): number {
  const row = store.get(key);
  if (!row || row.windowStart !== windowStart) {
    store.set(key, { count: 1, windowStart });
    return 1;
  }
  row.count += 1;
  return row.count;
}

/**
 * Fixed window. In-memory first, then Upstash when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set, otherwise the RateLimitBucket table.
 * A store error keeps the in-memory result so a blip does not lock everyone out.
 */
export async function consumeFixedWindow(input: {
  action: string;
  subject: string;
  limit: number;
  windowMs: number;
  now?: number;
  memory?: Map<string, MemoryBucket> | null;
  durable?: FixedWindowStore | null;
}): Promise<{ limited: boolean; key: string; count: number }> {
  const now = input.now ?? Date.now();
  const windowStart = now - (now % input.windowMs);
  const key = rateBucketKey(input.action, input.subject, windowStart);
  const memory = input.memory === undefined ? memoryBuckets : input.memory;
  const memoryCount = memory ? bumpMemory(memory, key, windowStart) : 0;
  const durable = input.durable === undefined ? defaultDurable(input.windowMs) : input.durable;
  let durableCount = 0;
  if (durable) {
    try {
      durableCount = await durable.increment(key, new Date(windowStart));
      if (now - lastCleanup > CLEANUP_EVERY_MS) {
        lastCleanup = now;
        void durable.cleanup(new Date(now - KEEP_MS)).catch((error: unknown) => {
          console.error("Rate limit cleanup failed", error);
        });
      }
    } catch (error) {
      console.error("Rate limit store failed", error);
      durableCount = memoryCount;
    }
  }
  const count = Math.max(memoryCount, durableCount);
  return { limited: count > input.limit, key, count };
}

export function loginSubject(ip: string, email: string): string {
  return `${ip || "unknown"}\n${email}`;
}

/** 30 reports per minute. The stored key hashes the IP. */
export async function takeClientErrorSlot(
  ip: string,
  deps?: {
    now?: number;
    memory?: Map<string, MemoryBucket> | null;
    durable?: FixedWindowStore | null;
  },
) {
  return consumeFixedWindow({
    action: "client_error",
    subject: ip || "unknown",
    limit: CLIENT_ERROR_LIMIT,
    windowMs: CLIENT_ERROR_WINDOW_MS,
    now: deps?.now,
    memory: deps && "memory" in deps ? deps.memory : undefined,
    durable: deps && "durable" in deps ? deps.durable : undefined,
  });
}

/** Send-home waitlist. The stored key hashes the IP. */
export async function limitDiasporaWaitlist(
  ip: string,
  deps?: {
    now?: number;
    memory?: Map<string, MemoryBucket> | null;
    durable?: FixedWindowStore | null;
  },
) {
  const hit = await consumeFixedWindow({
    action: "diaspora_waitlist",
    subject: ip || "unknown",
    limit: DIASPORA_WAITLIST_LIMIT,
    windowMs: DIASPORA_WAITLIST_WINDOW_MS,
    now: deps?.now,
    memory: deps && "memory" in deps ? deps.memory : undefined,
    durable: deps && "durable" in deps ? deps.durable : undefined,
  });
  return hit.limited;
}

/** Password reset keeps its 5/hour email and 20/hour IP limits, and now also writes the shared store. */
export async function limitPasswordReset(
  email: string,
  ip: string,
  now = Date.now(),
  deps?: {
    memory?: Map<string, number[]>;
    durable?: FixedWindowStore | null;
  },
): Promise<boolean> {
  const memoryLimited = takeResetSlot(email, ip || "unknown", now, deps?.memory);
  const emailHit = await consumeFixedWindow({
    action: "password_reset_email",
    subject: email,
    limit: RESET_EMAIL_LIMIT,
    windowMs: RESET_WINDOW_MS,
    now,
    memory: null,
    durable: deps?.durable,
  });
  const ipHit = await consumeFixedWindow({
    action: "password_reset_ip",
    subject: ip || "unknown",
    limit: RESET_IP_LIMIT,
    windowMs: RESET_WINDOW_MS,
    now,
    memory: null,
    durable: deps?.durable,
  });
  return memoryLimited || emailHit.limited || ipHit.limited;
}
