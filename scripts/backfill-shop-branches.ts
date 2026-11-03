// One-off, safe to re-run. Gives every shop with no branch a first branch copied from
// the owner's current town and phone. Shops that already have a branch are left alone.
// Run after the ShopBranch table exists: node --import tsx scripts/backfill-shop-branches.ts
import { PrismaClient } from "@prisma/client";
import { backfillShopBranches } from "../src/lib/shop-branches";

const prisma = new PrismaClient();

async function main() {
  const created = await backfillShopBranches(prisma);
  console.log(
    created === 0
      ? "Every shop already has a branch."
      : `Created a first branch for ${created} shop${created === 1 ? "" : "s"} from the current town.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
