-- Seller share handles + thank-you / visibility email tracking on Storefront.
-- Additive only. Existing shops keep empty handles and null sent-at timestamps.
-- Already-live shops are not back-sent a thank-you: only a fresh publish path writes thankYouEmailSentAt.
ALTER TABLE "Storefront" ADD COLUMN "instagramHandle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Storefront" ADD COLUMN "facebookHandle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Storefront" ADD COLUMN "xHandle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Storefront" ADD COLUMN "tiktokHandle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Storefront" ADD COLUMN "thankYouEmailSentAt" DATETIME;
ALTER TABLE "Storefront" ADD COLUMN "visibilityEmailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Storefront" ADD COLUMN "lastVisibilityEmailAt" DATETIME;
