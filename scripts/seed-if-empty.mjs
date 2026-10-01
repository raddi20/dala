import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tsx = join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "tsx", "dist", "cli.mjs");

try {
  // Exact bio sentence from the Dala rebrand only. Does not change passwords or roles.
  const renamed = await prisma.user.updateMany({
    where: {
      bio: "Moderates the Dala demo. This account can hide listings and grant the verified badge.",
    },
    data: {
      bio: "Moderates the Rangach demo. This account can hide listings and grant the verified badge.",
    },
  });
  if (renamed.count > 0) {
    console.log(`Updated ${renamed.count} profile bio to the Rangach name.`);
  }

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
