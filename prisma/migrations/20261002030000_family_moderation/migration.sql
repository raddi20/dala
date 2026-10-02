-- Moderation flags, reviews, and photo fingerprints.
-- New empty tables only. No columns or foreign keys on existing tables.
-- CreateTable
CREATE TABLE "ModerationFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "reason" TEXT NOT NULL DEFAULT '',
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ModerationReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flagId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MediaHash" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaType" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerUser" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "dhash" TEXT NOT NULL,
    "h0" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "h2" TEXT NOT NULL,
    "h3" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ModerationFlag_status_createdAt_idx" ON "ModerationFlag"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationFlag_targetType_targetId_idx" ON "ModerationFlag"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationReview_flagId_createdAt_idx" ON "ModerationReview"("flagId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaHash_h0_idx" ON "MediaHash"("h0");

-- CreateIndex
CREATE INDEX "MediaHash_h1_idx" ON "MediaHash"("h1");

-- CreateIndex
CREATE INDEX "MediaHash_h2_idx" ON "MediaHash"("h2");

-- CreateIndex
CREATE INDEX "MediaHash_h3_idx" ON "MediaHash"("h3");

-- CreateIndex
CREATE INDEX "MediaHash_ownerType_ownerId_idx" ON "MediaHash"("ownerType", "ownerId");
