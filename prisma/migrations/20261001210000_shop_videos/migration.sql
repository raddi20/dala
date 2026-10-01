-- Shop videos. New tables only. Existing shops, users, and payments are unchanged.

CREATE TABLE "ShopVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "uploadId" TEXT NOT NULL DEFAULT '',
    "assetId" TEXT NOT NULL DEFAULT '',
    "playbackId" TEXT NOT NULL DEFAULT '',
    "publicPlaybackId" TEXT NOT NULL DEFAULT '',
    "durationSeconds" REAL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT NOT NULL DEFAULT '',
    "posterUrl" TEXT NOT NULL DEFAULT '',
    "consentAt" DATETIME,
    "consentVersion" TEXT NOT NULL DEFAULT '',
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "rejectedAt" DATETIME,
    "purgeAfter" DATETIME,
    "muxDeletedAt" DATETIME,
    "aiStatus" TEXT NOT NULL DEFAULT '',
    "aiDetail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopVideo_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ShopVideoEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "adminId" TEXT NOT NULL DEFAULT '',
    "adminEmail" TEXT NOT NULL DEFAULT '',
    "adminName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopVideoEvent_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MuxEventReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ShopVideo_storefrontId_status_idx" ON "ShopVideo"("storefrontId", "status");
CREATE INDEX "ShopVideo_storefrontId_createdAt_idx" ON "ShopVideo"("storefrontId", "createdAt");
CREATE INDEX "ShopVideo_uploadId_idx" ON "ShopVideo"("uploadId");
CREATE INDEX "ShopVideo_assetId_idx" ON "ShopVideo"("assetId");
CREATE INDEX "ShopVideo_status_purgeAfter_idx" ON "ShopVideo"("status", "purgeAfter");
CREATE INDEX "ShopVideoEvent_storefrontId_createdAt_idx" ON "ShopVideoEvent"("storefrontId", "createdAt");
