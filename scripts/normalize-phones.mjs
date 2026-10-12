/**
 * Normalise stored phone and WhatsApp numbers to E.164.
 *
 * Covers User.phone, User.whatsapp, Listing.contactPhone, and Listing.contactWhatsapp.
 * Shop pages use the account phone and WhatsApp. There is no separate shop column.
 *
 * DRY RUN by default. Nothing is written unless you pass --apply.
 * Safe to run twice. A number that is already +E.164 is left as it is.
 * A number that cannot be read is left as it is and printed as a report.
 * Do not run this against production until you have read the dry run.
 *
 * The same plan is on /admin/phones for an admin who cannot pull database
 * secrets onto a laptop. That page is the dry run. Apply writes only the
 * fixable rows and adds one audit log entry.
 *
 * Local database (the .env file). This does not touch production:
 *   node --import tsx scripts/normalize-phones.mjs
 *   node --import tsx scripts/normalize-phones.mjs --apply
 *
 * Production, dry run first. `vercel env pull` writes a file. It does not change Vercel.
 *   npx vercel env pull .env.production.local
 *   node --env-file=.env.production.local --import tsx scripts/normalize-phones.mjs
 *   node --env-file=.env.production.local --import tsx scripts/normalize-phones.mjs --apply
 */
import { PrismaClient } from "@prisma/client";
import { commitPhonePlans, planPhoneRow, readPhoneRows, renderPhoneReport, writePhonePlan } from "../src/lib/phone.ts";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node --import tsx scripts/normalize-phones.mjs [--apply]

Dry run is the default. --apply writes E.164 numbers.
See the comment at the top of this file for the production commands.`);
  process.exit(0);
}

const apply = args.includes("--apply");
const prisma = new PrismaClient();

try {
  const plans = (await readPhoneRows(prisma)).map((row) => planPhoneRow(row));

  console.log(renderPhoneReport(plans, apply));

  const written = await commitPhonePlans(plans, apply, (plan) => writePhonePlan(prisma, plan));

  if (apply) console.log(`Wrote ${written} ${written === 1 ? "row" : "rows"}.`);
} finally {
  await prisma.$disconnect();
}
