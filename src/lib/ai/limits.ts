import type { AiActor, AiFeature } from "@/lib/ai/types";

export type RateScope = "actor" | "user" | "global";

export type RateWindow = {
  scope: RateScope;
  limit: number;
  windowMs: number;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const MONTH_MS = 30 * DAY;

/** One AI check per listing is debounced for this long. The moderation stage applies it. */
export const MODERATION_DEBOUNCE_MS = 10 * 60 * 1000;

export function rateWindows(feature: AiFeature): RateWindow[] {
  switch (feature) {
    case "smart_search":
      return [
        { scope: "actor", limit: 20, windowMs: HOUR },
        { scope: "global", limit: 3000, windowMs: DAY },
      ];
    case "listing_writer":
      return [
        { scope: "user", limit: 15, windowMs: DAY },
        { scope: "user", limit: 100, windowMs: MONTH_MS },
      ];
    case "family_helper":
      return [{ scope: "actor", limit: 10, windowMs: DAY }];
    case "moderation":
      return [{ scope: "user", limit: 50, windowMs: DAY }];
    case "seller_tips":
      return [];
    default:
      return [];
  }
}

/** Events with createdAt in [now - window, now] count. Older ones do not. */
export function countInWindow(timestamps: number[], now: number, windowMs: number): number {
  const start = now - windowMs;
  let count = 0;
  for (const stamp of timestamps) {
    if (stamp >= start && stamp <= now) count += 1;
  }
  return count;
}

export function overWindow(timestamps: number[], now: number, windowMs: number, limit: number): boolean {
  return countInWindow(timestamps, now, windowMs) >= limit;
}

export function isDebounced(lastAt: number | null, now: number, windowMs = MODERATION_DEBOUNCE_MS): boolean {
  if (lastAt === null) return false;
  return now - lastAt < windowMs;
}

export type RateCount = (query: {
  feature: AiFeature;
  since: Date;
  userId?: string;
  actorHash?: string;
}) => Promise<number>;

export async function isRateCapped(feature: AiFeature, actor: AiActor, now: number, count: RateCount): Promise<boolean> {
  for (const window of rateWindows(feature)) {
    if (window.scope === "actor" && !actor.actorHash) return true;
    if (window.scope === "user" && !actor.userId) return true;
    const hits = await count({
      feature,
      since: new Date(now - window.windowMs),
      userId: window.scope === "user" ? actor.userId : undefined,
      actorHash: window.scope === "actor" ? actor.actorHash : undefined,
    });
    if (hits >= window.limit) return true;
  }
  return false;
}
