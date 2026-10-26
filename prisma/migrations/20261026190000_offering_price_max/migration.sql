-- Optional upper bound for price ranges. Additive and nullable; existing single prices are unchanged.
ALTER TABLE "Offering" ADD COLUMN "priceMaxCents" INTEGER;
