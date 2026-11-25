import { CATEGORIES } from "@/lib/categories";
import { DEMO_EMAIL_DOMAIN } from "@/lib/admin-access";

/**
 * Planning for a one-off listing category refile (scripts/refile-categories.ts).
 * Pure functions only, so the plan can be tested without a database.
 * Only Listing.category is ever changed. Shops have no category column.
 */

export type RefileRow = {
  entity: "listing";
  id: string;
  title: string;
  shop?: string;
  from: string;
  to: string;
  reason: string;
};

export type RefileMapping = { rows: RefileRow[] };
export type RefileBackup = { rows: { id: string; category: string }[] };

/** What the database holds now for one listing. Undefined when the id is missing. */
export type CurrentListing = { id: string; category: string; ownerEmail: string };

export type RefileMode = "apply" | "revert";

export type PlannedChange = { id: string; title: string; from: string; to: string };
export type SkippedRow = { id: string; title: string; reason: string };

export type RefilePlan = {
  mode: RefileMode;
  changes: PlannedChange[];
  alreadyDone: PlannedChange[];
  skipped: SkippedRow[];
};

const KNOWN = new Set<string>(CATEGORIES);

export function isKnownCategory(value: string): boolean {
  return KNOWN.has(value);
}

export function isDemoOwner(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);
}

/** Problems with the mapping or backup files. An empty list means both are usable. */
export function validateRefileFiles(mapping: RefileMapping, backup: RefileBackup): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const backupById = new Map(backup.rows.map((row) => [row.id, row.category]));
  for (const row of mapping.rows) {
    if (row.entity !== "listing") problems.push(`${row.id}: entity must be "listing"`);
    if (!row.id) problems.push("A row has no id");
    if (seen.has(row.id)) problems.push(`${row.id}: listed twice`);
    seen.add(row.id);
    if (!isKnownCategory(row.from)) problems.push(`${row.id}: unknown from category "${row.from}"`);
    if (!isKnownCategory(row.to)) problems.push(`${row.id}: unknown to category "${row.to}"`);
    if (row.from === row.to) problems.push(`${row.id}: from and to are the same`);
    const saved = backupById.get(row.id);
    if (saved === undefined) problems.push(`${row.id}: missing from the backup`);
    else if (saved !== row.from) problems.push(`${row.id}: backup has "${saved}" but the mapping expects "${row.from}"`);
  }
  for (const row of backup.rows) {
    if (!seen.has(row.id)) problems.push(`${row.id}: in the backup but not in the mapping`);
  }
  return problems;
}

/**
 * Plan an apply (from -> to) or a revert (to -> backup value).
 * A row changes only when the database still holds the expected value, so running
 * twice is safe: done rows are reported as already done and anything else is skipped.
 */
export function planRefile(
  mode: RefileMode,
  mapping: RefileMapping,
  backup: RefileBackup,
  current: ReadonlyMap<string, CurrentListing>,
): RefilePlan {
  const backupById = new Map(backup.rows.map((row) => [row.id, row.category]));
  const plan: RefilePlan = { mode, changes: [], alreadyDone: [], skipped: [] };
  for (const row of mapping.rows) {
    const now = current.get(row.id);
    const expected = mode === "apply" ? row.from : row.to;
    const target = mode === "apply" ? row.to : backupById.get(row.id);
    if (!now) {
      plan.skipped.push({ id: row.id, title: row.title, reason: "Listing not found" });
      continue;
    }
    if (isDemoOwner(now.ownerEmail)) {
      plan.skipped.push({ id: row.id, title: row.title, reason: "Demo listing, left alone" });
      continue;
    }
    if (target === undefined || !isKnownCategory(target)) {
      plan.skipped.push({ id: row.id, title: row.title, reason: "No usable backup value" });
      continue;
    }
    if (now.category === target) {
      plan.alreadyDone.push({ id: row.id, title: row.title, from: expected, to: target });
      continue;
    }
    if (now.category !== expected) {
      plan.skipped.push({
        id: row.id,
        title: row.title,
        reason: `Category is now "${now.category}", expected "${expected}"`,
      });
      continue;
    }
    plan.changes.push({ id: row.id, title: row.title, from: now.category, to: target });
  }
  return plan;
}

/** Counts of planned moves by target category, largest first. */
export function countByTarget(changes: readonly PlannedChange[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const change of changes) counts.set(change.to, (counts.get(change.to) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

/**
 * The deploy step applies only on the first production build: while more than half
 * of the rows still hold their old value. After that, later builds only report, so a
 * seller who later picks the old category again is never overridden by a rebuild.
 */
export function buildShouldApply(plan: RefilePlan, total: number): boolean {
  if (plan.mode !== "apply" || total === 0) return false;
  return plan.changes.length * 2 > total;
}
