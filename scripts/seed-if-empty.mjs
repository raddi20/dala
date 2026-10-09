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
  const showDemo = /^(1|true|yes|on)$/i.test((process.env.SHOW_DEMO_SHOPS ?? "").trim());
  // Seed only an empty database. Never update listing.hidden or storefront.published,
  // so a later deploy cannot re-create demo rows or turn them public again.
  if (users > 0) {
    console.log(
      `Database already has ${users} users. Skipping seed. Demo rows stay as they are. SHOW_DEMO_SHOPS is ${showDemo ? "on" : "off"}.`,
    );
  } else {
    console.log(
      showDemo
        ? "Database is empty. Loading the demo seed. SHOW_DEMO_SHOPS is on, so those rows are public."
        : "Database is empty. Loading the demo seed. SHOW_DEMO_SHOPS is off, so public pages hide those rows until the flag is turned on.",
    );
    execFileSync(process.execPath, [tsx, "prisma/seed.ts"], { stdio: "inherit" });
  }

  // Occasion pages are created when missing. Titles and intros already saved are left alone.
  execFileSync(process.execPath, [tsx, "scripts/ensure-occasions.ts"], { stdio: "inherit" });
} finally {
  await prisma.$disconnect();
}
