-- Additive shop checks and an append-only audit table.
-- Existing storefront rows stay. New flags default to false.
ALTER TABLE "Storefront" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Storefront" ADD COLUMN "locationVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Storefront" ADD COLUMN "businessVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShopBadgeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL DEFAULT '',
    "adminName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopBadgeEvent_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopBadgeEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShopBadgeEvent_storefrontId_createdAt_idx" ON "ShopBadgeEvent"("storefrontId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopBadgeEvent_adminId_idx" ON "ShopBadgeEvent"("adminId");
