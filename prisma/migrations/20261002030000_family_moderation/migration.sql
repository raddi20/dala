-- Moderation suggestions and photo fingerprints.
-- New empty tables only. No columns or foreign keys on existing tables.
-- CreateTable
CREATE TABLE "AiModerationSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "flagsJson" TEXT NOT NULL DEFAULT '[]',
    "suggestedCategory" TEXT NOT NULL DEFAULT '',
    "photoHash" TEXT NOT NULL DEFAULT '',
    "duplicateIds" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" DATETIME,
    "dismissedById" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "AiPhotoFingerprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL DEFAULT '',
    "photoHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AiModerationSuggestion_status_createdAt_idx" ON "AiModerationSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiModerationSuggestion_listingId_createdAt_idx" ON "AiModerationSuggestion"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "AiModerationSuggestion_photoHash_idx" ON "AiModerationSuggestion"("photoHash");

-- CreateIndex
CREATE INDEX "AiPhotoFingerprint_photoHash_idx" ON "AiPhotoFingerprint"("photoHash");

-- CreateIndex
CREATE INDEX "AiPhotoFingerprint_listingId_idx" ON "AiPhotoFingerprint"("listingId");
