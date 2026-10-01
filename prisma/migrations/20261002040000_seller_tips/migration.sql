-- Weekly seller tips. New empty table only.
-- CreateTable
CREATE TABLE "SellerTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL DEFAULT '',
    "weekStart" DATETIME NOT NULL,
    "statsJson" TEXT NOT NULL,
    "tipsJson" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "emailedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerTip_userId_weekStart_key" ON "SellerTip"("userId", "weekStart");
