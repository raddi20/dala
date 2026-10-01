-- AI foundation and stats. New empty tables only.
-- Does not alter User, Listing, Storefront, or any other existing table.
-- Shop videos migration 20261001210000_shop_videos creates ShopVideo, ShopVideoEvent,
-- and MuxEventReceipt. This file does not touch those tables. Apply either one first.
-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "actorHash" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT NOT NULL DEFAULT '',
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "promptVersion" TEXT NOT NULL DEFAULT '',
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiFlag" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "listingId" TEXT NOT NULL DEFAULT '',
    "storefrontId" TEXT NOT NULL DEFAULT '',
    "sessionHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_feature_createdAt_idx" ON "AiUsage"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_actorHash_createdAt_idx" ON "AiUsage"("actorHash", "createdAt");

-- CreateIndex
CREATE INDEX "StatEvent_storefrontId_createdAt_idx" ON "StatEvent"("storefrontId", "createdAt");

-- CreateIndex
CREATE INDEX "StatEvent_listingId_createdAt_idx" ON "StatEvent"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "StatEvent_createdAt_idx" ON "StatEvent"("createdAt");

