/**
 * One-off listing category refile from the 25 November 2026 category audit.
 *
 *   npm run refile:categories                 dry run: reads the database, prints the plan, writes nothing
 *   npm run refile:categories -- --apply      changes Listing.category for the planned rows, in one transaction
 *   npm run refile:categories -- --revert     puts back the values in the backup file, the same way
 *   npm run refile:categories -- --snapshot <file.json>
 *                                             dry run against a saved list of { id, category, demo } instead of the database
 *   --build                                   the deploy step: applies only on a production build, and only the first time
 *
 * Only the category column changes. Titles, prices, photos, owners and updatedAt are left as they are.
 * A row changes only while it still holds the expected value, so reruns are safe.
 * Demo (@dala.local) listings are never touched.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  buildShouldApply,
  countByTarget,
  planRefile,
  validateRefileFiles,
  type CurrentListing,
  type RefileBackup,
  type RefileMapping,
  type RefileMode,
  type RefilePlan,
} from "../src/lib/category-refile";

const DATA = path.join(process.cwd(), "scripts", "data");
const MAPPING_FILE = path.join(DATA, "category-refile-2026-11-25.json");
const BACKUP_FILE = path.join(DATA, "category-refile-2026-11-25.backup.json");

type Args = { apply: boolean; revert: boolean; build: boolean; snapshot: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, revert: false, build: false, snapshot: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") args.apply = true;
    else if (value === "--revert") args.revert = true;
    else if (value === "--build") args.build = true;
    else if (value === "--snapshot") args.snapshot = argv[++index] ?? "";
    else throw new Error(`Unknown option ${value}`);
  }
  const writes = [args.apply, args.revert, args.build].filter(Boolean).length;
  if (writes > 1) throw new Error("Use only one of --apply, --revert or --build.");
  if (args.snapshot && writes > 0) throw new Error("--snapshot is a dry run only.");
  return args;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function printPlan(plan: RefilePlan, total: number, label: string) {
  console.log(`${label}: ${plan.mode}, ${total} rows in the mapping.`);
  console.log(`  to change:    ${plan.changes.length}`);
  console.log(`  already done: ${plan.alreadyDone.length}`);
  console.log(`  skipped:      ${plan.skipped.length}`);
  for (const [category, count] of countByTarget(plan.changes)) console.log(`    -> ${category}: ${count}`);
  for (const change of plan.changes) console.log(`  ${change.id}  ${change.from} -> ${change.to}  (${change.title})`);
  for (const row of plan.skipped) console.log(`  SKIP ${row.id}  ${row.reason}  (${row.title})`);
}

async function readCurrent(prisma: PrismaClient, ids: string[]): Promise<Map<string, CurrentListing>> {
  const rows = await prisma.listing.findMany({
    where: { id: { in: ids } },
    select: { id: true, category: true, owner: { select: { email: true } } },
  });
  return new Map(rows.map((row) => [row.id, { id: row.id, category: row.category, ownerEmail: row.owner.email }]));
}

async function writePlan(prisma: PrismaClient, plan: RefilePlan) {
  // Before-values straight from the database, so the deploy log also holds a backup.
  console.log(`BEFORE ${JSON.stringify(plan.changes.map((change) => ({ id: change.id, category: change.from })))}`);
  await prisma.$transaction(async (tx) => {
    for (const change of plan.changes) {
      const updated = await tx.$executeRaw`UPDATE "Listing" SET "category" = ${change.to} WHERE "id" = ${change.id} AND "category" = ${change.from}`;
      if (updated !== 1) throw new Error(`${change.id} changed while the refile ran. Nothing was written.`);
    }
  });
  console.log(`Wrote ${plan.changes.length} category change${plan.changes.length === 1 ? "" : "s"} in one transaction.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mapping = readJson<RefileMapping>(MAPPING_FILE);
  const backup = readJson<RefileBackup>(BACKUP_FILE);
  const problems = validateRefileFiles(mapping, backup);
  if (problems.length > 0) {
    for (const line of problems) console.error(`  ${line}`);
    throw new Error("The refile files failed their checks. Nothing was read or written.");
  }
  const total = mapping.rows.length;
  const mode: RefileMode = args.revert ? "revert" : "apply";

  if (args.snapshot) {
    const snapshot = readJson<{ id: string; category: string; demo?: boolean | string }[]>(args.snapshot);
    const current = new Map(
      snapshot.map((row) => [
        row.id,
        { id: row.id, category: row.category, ownerEmail: String(row.demo) === "true" || String(row.demo) === "True" ? "demo@dala.local" : "" },
      ]),
    );
    printPlan(planRefile(mode, mapping, backup, current), total, `Dry run from ${path.basename(args.snapshot)}`);
    return;
  }

  if (args.build && process.env.VERCEL_ENV !== "production") {
    console.log("Category refile: not a production build, so nothing was read or written.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const current = await readCurrent(prisma, mapping.rows.map((row) => row.id));
    const plan = planRefile(mode, mapping, backup, current);
    const write = args.apply || args.revert || (args.build && buildShouldApply(plan, total));
    printPlan(plan, total, write ? "Category refile" : "Category refile dry run (no writes)");
    if (args.build && !write) {
      console.log(
        `Category refile: only ${plan.changes.length} of ${total} rows still hold their old category, so this build only reports. The deploy step writes only on the first deploy, while most rows are unchanged.`,
      );
      return;
    }
    if (!write) return;
    if (plan.changes.length === 0) {
      console.log("Nothing to write.");
      return;
    }
    await writePlan(prisma, plan);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
