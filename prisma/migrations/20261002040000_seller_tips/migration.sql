-- Weekly seller tip log. New empty table only.
-- CreateTable
CREATE TABLE "AiSellerTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT '',
    "weekStart" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "tipsJson" TEXT NOT NULL DEFAULT '[]',
    "emailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSellerTip_userId_weekStart_key" ON "AiSellerTip"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "AiSellerTip_createdAt_idx" ON "AiSellerTip"("createdAt");
