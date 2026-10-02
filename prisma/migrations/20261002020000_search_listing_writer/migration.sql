-- Smart search cache, listing drafts, and seller AI consent.
-- New empty tables only. No columns or foreign keys on existing tables.
-- CreateTable
CREATE TABLE "AiSearchCache" (
    "queryKey" TEXT NOT NULL PRIMARY KEY,
    "resultJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiListingDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT '',
    "listingId" TEXT NOT NULL DEFAULT '',
    "inputText" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'en',
    "suggestionJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SellerAiPrefs" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "aiConsentAt" DATETIME,
    "language" TEXT NOT NULL DEFAULT 'en',
    "tipsEmailOptIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AiListingDraft_userId_createdAt_idx" ON "AiListingDraft"("userId", "createdAt");
