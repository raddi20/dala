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
import { commitPhonePlans, planPhoneRow, renderPhoneReport } from "../src/lib/phone.ts";

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
  const [users, listings] = await Promise.all([
    prisma.user.findMany({ select: { id: true, city: true, phone: true, whatsapp: true } }),
    prisma.listing.findMany({
      select: { id: true, city: true, contactPhone: true, contactWhatsapp: true },
    }),
  ]);

  const plans = [
    ...users.map((user) =>
      planPhoneRow({ kind: "user", id: user.id, city: user.city, phone: user.phone, whatsapp: user.whatsapp }),
    ),
    ...listings.map((listing) =>
      planPhoneRow({
        kind: "listing",
        id: listing.id,
        city: listing.city,
        phone: listing.contactPhone,
        whatsapp: listing.contactWhatsapp,
      }),
    ),
  ];

  console.log(renderPhoneReport(plans, apply));

  const written = await commitPhonePlans(plans, apply, async (plan) => {
    if (plan.kind === "user") {
      await prisma.user.update({
        where: { id: plan.id },
        data: { phone: plan.phone, whatsapp: plan.whatsapp },
      });
      return;
    }
    await prisma.listing.update({
      where: { id: plan.id },
      data: { contactPhone: plan.phone, contactWhatsapp: plan.whatsapp },
    });
  });

  if (apply) console.log(`Wrote ${written} ${written === 1 ? "row" : "rows"}.`);
} finally {
  await prisma.$disconnect();
}
