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
  const hideDemo = /^(1|true|yes|on)$/i.test((process.env.HIDE_DEMO_SHOPS ?? "").trim());
  // Seed only an empty database. Never update listing.hidden or storefront.published,
  // so a later deploy cannot re-create demo rows or flip their visibility.
  if (users > 0) {
    console.log(
      `Database already has ${users} users. Skipping seed. Demo rows stay as they are. HIDE_DEMO_SHOPS is ${hideDemo ? "on" : "off"}.`,
    );
  } else {
    console.log(
      hideDemo
        ? "Database is empty. Loading the demo seed. HIDE_DEMO_SHOPS is on, so public pages hide those rows."
        : "Database is empty. Loading the demo seed. HIDE_DEMO_SHOPS is off, so those rows stay public. Placeholder phone numbers stay hidden.",
    );
    execFileSync(process.execPath, [tsx, "prisma/seed.ts"], { stdio: "inherit" });
  }

  // Occasion pages are created when missing. Titles and intros already saved are left alone.
  execFileSync(process.execPath, [tsx, "scripts/ensure-occasions.ts"], { stdio: "inherit" });
} finally {
  await prisma.$disconnect();
}
