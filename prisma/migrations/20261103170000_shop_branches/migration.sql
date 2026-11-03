-- Multi-branch shops. Additive only: a new table, no change to existing columns.
-- Existing shops keep working with no rows here (the app falls back to User.city).
-- After this table exists, run scripts/backfill-shop-branches.ts once to copy each
-- shop's current town and phone into its first branch.
CREATE TABLE "ShopBranch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontId" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopBranch_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ShopBranch_storefrontId_sortOrder_idx" ON "ShopBranch"("storefrontId", "sortOrder");
CREATE INDEX "ShopBranch_town_idx" ON "ShopBranch"("town");
