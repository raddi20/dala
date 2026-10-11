-- Visits from a printed shop sticker. A count only. No visitor id, and existing rows stay at 0.

ALTER TABLE "Storefront" ADD COLUMN "stickerScans" INTEGER NOT NULL DEFAULT 0;
