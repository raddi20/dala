/**
 * Community plan gate.
 *
 * Checkout is not open, so follows, posting, and how often a shop can post
 * are free for every shop. When checkout opens, set COMMUNITY_PRO_GATE to true:
 * a free shop can post one update a week, and a Pro shop can post once a day
 * plus a pinned update. Do not turn the gate on until payments are live.
 *
 * Browser push is not part of this layer. The service worker is the offline
 * cache. Adding Web Push would mean a new send library, VAPID keys, and a
 * change to that worker. The Monday email covers the same nudge.
 */
export const COMMUNITY_PRO_GATE = false;

export const FREE_UPDATES_PER_WEEK = 1;
export const PRO_UPDATES_PER_DAY = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function updatesAllowed(input: {
  pro: boolean;
  now: Date;
  postedAt: Date[];
  gate?: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!(input.gate ?? COMMUNITY_PRO_GATE)) return { ok: true };
  if (input.pro) {
    const since = input.now.getTime() - DAY_MS;
    const today = input.postedAt.filter((at) => at.getTime() >= since).length;
    if (today >= PRO_UPDATES_PER_DAY) {
      return { ok: false, message: "Pro shops can post one update a day. Try again tomorrow." };
    }
    return { ok: true };
  }
  const since = input.now.getTime() - WEEK_MS;
  const week = input.postedAt.filter((at) => at.getTime() >= since).length;
  if (week >= FREE_UPDATES_PER_WEEK) {
    return { ok: false, message: "Free shops can post one update a week. Try again next week." };
  }
  return { ok: true };
}
