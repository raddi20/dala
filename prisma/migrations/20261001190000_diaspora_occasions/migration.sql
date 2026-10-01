-- Additive. Existing shops stay, with diaspora orders off until a seller or admin turns it on.
ALTER TABLE "Storefront" ADD COLUMN "servesDiaspora" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopOccasion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occasionId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopOccasion_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopOccasion_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingOccasion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occasionId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingOccasion_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "Occasion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingOccasion_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Occasion_slug_key" ON "Occasion"("slug");

-- CreateIndex
CREATE INDEX "ShopOccasion_occasionId_pinned_idx" ON "ShopOccasion"("occasionId", "pinned");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOccasion_occasionId_storefrontId_key" ON "ShopOccasion"("occasionId", "storefrontId");

-- CreateIndex
CREATE INDEX "ListingOccasion_occasionId_pinned_idx" ON "ListingOccasion"("occasionId", "pinned");

-- CreateIndex
CREATE UNIQUE INDEX "ListingOccasion_occasionId_listingId_key" ON "ListingOccasion"("occasionId", "listingId");

-- CreateIndex
CREATE INDEX "Storefront_servesDiaspora_idx" ON "Storefront"("servesDiaspora");
