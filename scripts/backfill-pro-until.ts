import { PrismaClient } from "@prisma/client";
import { backfillLegacyProUntil, formatPlanDate } from "../src/lib/pro";

const prisma = new PrismaClient();

async function main() {
  const { updated, until } = await backfillLegacyProUntil(prisma);
  if (updated === 0) {
    console.log("No existing Pro shops needed a grace date.");
  } else {
    console.log(
      `Set Verified Pro to run until ${formatPlanDate(until)} (${until.toISOString()}) for ${updated} existing Pro shop${updated === 1 ? "" : "s"}. A later deploy does not move that date.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
