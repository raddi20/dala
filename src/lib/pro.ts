import { FREE_OFFERING_CAP, PRO_DAYS } from "@/lib/constants";

const DAY_MS = 86_400_000;

export type ProFields = {
  verifiedPro: boolean;
  verifiedProUntil?: Date | null;
};

/**
 * Pro perks are on when the plan flag is set and the end date is still ahead.
 * A row with the flag on and no end date is a shop that paid before expiry
 * existed. Treat it as on until the deploy backfill writes the grace date.
 * After that date passes, perks turn off. Offerings, the banner, and the video stay stored.
 */
export function isProActive(user: ProFields, now: Date = new Date()): boolean {
  if (!user.verifiedPro) return false;
  if (user.verifiedProUntil == null) return true;
  const end = user.verifiedProUntil.getTime();
  if (!Number.isFinite(end)) return true;
  return end > now.getTime();
}

/** The plan had an end date, or the flag is still on, but the perks are off. */
export function proLapsed(user: ProFields, now: Date = new Date()): boolean {
  if (isProActive(user, now)) return false;
  return user.verifiedPro || user.verifiedProUntil != null;
}

/**
 * Next end date for a successful payment or an admin grant.
 * A plan that is still running grows from its current end. An ended or missing date grows from now.
 */
export function extendProUntil(current: Date | null | undefined, now: Date): Date {
  const currentMs = current instanceof Date ? current.getTime() : Number.NaN;
  const base = Number.isFinite(currentMs) && currentMs > now.getTime() ? currentMs : now.getTime();
  return new Date(base + PRO_DAYS * DAY_MS);
}

/** Date written once for shops that already had Pro and no end date. */
export function proGraceUntil(now: Date): Date {
  return extendProUntil(null, now);
}

export function formatPlanDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

type ProWriter = {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { verifiedProUntil: true };
    }): Promise<{ verifiedProUntil: Date | null } | null>;
    update(args: {
      where: { id: string };
      data: { verifiedPro: boolean; verifiedProUntil: Date | null };
      select: { id: true; verifiedPro: true; verifiedProUntil: true };
    }): Promise<{ id: string; verifiedPro: boolean; verifiedProUntil: Date | null }>;
    updateMany(args: {
      where: { verifiedPro: boolean; verifiedProUntil: null };
      data: { verifiedProUntil: Date };
    }): Promise<{ count: number }>;
  };
};

/** Admin grant adds 30 days. Admin revoke clears the plan. Shop verification badges are not touched. */
export async function setUserPro(db: ProWriter, userId: string, grant: boolean, now: Date = new Date()) {
  if (!grant) {
    return db.user.update({
      where: { id: userId },
      data: { verifiedPro: false, verifiedProUntil: null },
      select: { id: true, verifiedPro: true, verifiedProUntil: true },
    });
  }
  const current = await db.user.findUnique({ where: { id: userId }, select: { verifiedProUntil: true } });
  if (!current) return null;
  return db.user.update({
    where: { id: userId },
    data: { verifiedPro: true, verifiedProUntil: extendProUntil(current.verifiedProUntil, now) },
    select: { id: true, verifiedPro: true, verifiedProUntil: true },
  });
}

/**
 * One-time grace for shops that already had Pro. Only rows with the flag on and
 * no end date are updated, so a second run does not add another 30 days.
 */
export async function backfillLegacyProUntil(db: ProWriter, now: Date = new Date()) {
  const until = proGraceUntil(now);
  const result = await db.user.updateMany({
    where: { verifiedPro: true, verifiedProUntil: null },
    data: { verifiedProUntil: until },
  });
  return { updated: result.count, until };
}

/**
 * Public shop order is sortOrder ascending, then createdAt ascending:
 * the order the seller set with Up and Down, oldest first when that order ties.
 * When Pro is off, the first free-plan slots stay on the public shop.
 * The rest stay saved and come back on renewal. Nothing is archived or deleted.
 */
export function visibleOfferings<T>(offerings: readonly T[], proActive: boolean, freeCap = FREE_OFFERING_CAP): T[] {
  if (proActive) return [...offerings];
  if (freeCap <= 0) return [];
  return offerings.slice(0, freeCap);
}

export function hiddenOfferings<T>(offerings: readonly T[], proActive: boolean, freeCap = FREE_OFFERING_CAP): T[] {
  if (proActive) return [];
  if (freeCap <= 0) return [...offerings];
  return offerings.slice(freeCap);
}
