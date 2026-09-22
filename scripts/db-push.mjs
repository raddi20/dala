import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const prismaJs = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "prisma", "build", "index.js");

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

/**
 * Prisma treats a new unique index on a populated table as possible data loss and
 * exits 1. That index is Payment.reference (the Flutterwave tx_ref). Retrying with
 * --accept-data-loss adds the index and keeps every row. Duplicate references still
 * fail in Postgres. Any other data-loss warning must keep failing the build.
 */
export function shouldRetryWithAcceptDataLoss(text) {
  const clean = stripAnsi(text);
  if (!clean.includes("--accept-data-loss")) return false;
  const section = clean.split(/There might be data loss/i)[1] ?? "";
  const bullets = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("•"));
  if (bullets.length !== 1) return false;
  const only = bullets[0];
  return only.includes("unique constraint") && only.includes("[reference]") && only.includes("Payment");
}

function runPush(acceptDataLoss) {
  const args = [prismaJs, "db", "push", "--skip-generate"];
  if (acceptDataLoss) args.push("--accept-data-loss");
  return spawnSync(process.execPath, args, { encoding: "utf8", env: process.env });
}

function writeResult(result) {
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (out) process.stdout.write(out.endsWith("\n") ? out : `${out}\n`);
}

function main() {
  const first = runPush(false);
  if (first.error) {
    console.error(first.error.message);
    process.exit(1);
  }
  writeResult(first);
  if (first.status === 0) process.exit(0);

  const combined = `${first.stdout ?? ""}\n${first.stderr ?? ""}`;
  if (!shouldRetryWithAcceptDataLoss(combined)) process.exit(first.status ?? 1);

  console.log(
    "Prisma stopped before adding a unique index on Payment.reference. Retrying with --accept-data-loss. Existing rows stay. Duplicate references still fail the index.",
  );
  const second = runPush(true);
  if (second.error) {
    console.error(second.error.message);
    process.exit(1);
  }
  writeResult(second);
  process.exit(second.status ?? 1);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
