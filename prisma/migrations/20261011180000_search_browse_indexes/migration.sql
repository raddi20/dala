-- Additive indexes for shop and offering browse. No new columns.
CREATE INDEX "User_city_idx" ON "User"("city");
CREATE INDEX "Listing_createdAt_idx" ON "Listing"("createdAt");
CREATE INDEX "Listing_verified_idx" ON "Listing"("verified");
CREATE INDEX "Listing_hidden_category_idx" ON "Listing"("hidden", "category");
CREATE INDEX "Storefront_published_createdAt_idx" ON "Storefront"("published", "createdAt");
CREATE INDEX "Offering_archived_createdAt_idx" ON "Offering"("archived", "createdAt");
