-- Additive column on AiUsage only. Existing rows stay. Null until a new failure is stored.
-- Does not alter User, Listing, Storefront, or shop-video tables.
ALTER TABLE "AiUsage" ADD COLUMN "errorDetail" TEXT;
