import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tsx = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "tsx", "dist", "cli.mjs");

try {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`Database already has ${users} users. Skipping seed.`);
  } else {
    console.log("Database is empty. Loading the demo seed.");
    execFileSync(process.execPath, [tsx, "prisma/seed.ts"], { stdio: "inherit" });
  }
} finally {
  await prisma.$disconnect();
}
