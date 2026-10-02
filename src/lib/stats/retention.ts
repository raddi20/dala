import { prisma } from "@/lib/prisma";

export const STAT_RETENTION_DAYS = 180;
const PURGE_GAP_MS = 60 * 60 * 1000;

export function statRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCDate(cutoff.getUTCDate() - STAT_RETENTION_DAYS);
  return cutoff;
}

export async function purgeStatEventsBefore(cutoff: Date): Promise<number> {
  const result = await prisma.statEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

let lastPurge = 0;

/** Best-effort cleanup until the weekly cron in a later stage calls the same cutoff. */
export async function maybePurgeStatEvents(now = Date.now()): Promise<void> {
  if (now - lastPurge < PURGE_GAP_MS) return;
  lastPurge = now;
  try {
    await purgeStatEventsBefore(statRetentionCutoff(new Date(now)));
  } catch {
    lastPurge = 0;
  }
}
