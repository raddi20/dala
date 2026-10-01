-- Smart search cache, listing drafts, and seller AI consent.
-- New empty tables only. No columns or foreign keys on existing tables.
-- CreateTable
CREATE TABLE "AiSearchCache" (
    "queryHash" TEXT NOT NULL PRIMARY KEY,
    "queryNorm" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiListingDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT '',
    "listingId" TEXT NOT NULL DEFAULT '',
    "inputText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "outputJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SellerAiPrefs" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "aiConsentAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AiSearchCache_expiresAt_idx" ON "AiSearchCache"("expiresAt");

-- CreateIndex
CREATE INDEX "AiListingDraft_userId_createdAt_idx" ON "AiListingDraft"("userId", "createdAt");
