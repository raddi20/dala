import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL ?? "";
const postgres = /^postgres(ql)?:/i.test(url);
const onVercel = process.env.VERCEL === "1";

if (onVercel && !postgres) {
  console.error(
    "DATABASE_URL must be a postgres:// or postgresql:// URL on Vercel. A SQLite file does not persist on serverless.",
  );
  process.exit(1);
}

if (onVercel) {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 16 || secret === "dala-dev-secret-change-me") {
    console.error("Set AUTH_SECRET to a long random string (at least 16 characters) before deploying.");
    process.exit(1);
  }
}

if (!url) {
  console.log("DATABASE_URL is unset. Leaving the Prisma provider as committed.");
  process.exit(0);
}

const provider = postgres ? "postgresql" : "sqlite";
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");
const pattern = /(datasource\s+db\s*\{[^}]*provider\s*=\s*")(?:sqlite|postgresql)(")/;
if (!pattern.test(schema)) {
  console.error("Could not find the Prisma datasource provider in prisma/schema.prisma.");
  process.exit(1);
}
const updated = schema.replace(pattern, `$1${provider}$2`);
if (updated !== schema) writeFileSync(schemaPath, updated);
console.log(`Prisma provider set to ${provider}.`);
