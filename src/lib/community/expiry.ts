export const UPDATE_TTL_DAYS = 60;
export const UPDATE_TTL_MS = UPDATE_TTL_DAYS * 24 * 60 * 60 * 1000;

export function updateExpiresAt(postedAt: Date): Date {
  return new Date(postedAt.getTime() + UPDATE_TTL_MS);
}

/** Hidden from reads the moment it expires, before the cleanup cron runs. */
export function updateIsPublic(row: { status: string; expiresAt: Date }, now: Date): boolean {
  return row.status === "approved" && row.expiresAt.getTime() > now.getTime();
}

export function expiredUpdateIds(rows: { id: string; expiresAt: Date }[], now: Date): string[] {
  return rows.filter((row) => row.expiresAt.getTime() <= now.getTime()).map((row) => row.id);
}
