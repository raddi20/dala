-- Send-home waitlist. New table, plus one flag on existing shops. Existing shops stay off. No payment column.

ALTER TABLE "Storefront" ADD COLUMN "sendHomePilot" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Storefront_sendHomePilot_idx" ON "Storefront"("sendHomePilot");

CREATE TABLE "DiasporaWaitlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "homeArea" TEXT NOT NULL,
    "baskets" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "consentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DiasporaWaitlist_country_idx" ON "DiasporaWaitlist"("country");
CREATE INDEX "DiasporaWaitlist_homeArea_idx" ON "DiasporaWaitlist"("homeArea");
CREATE INDEX "DiasporaWaitlist_createdAt_idx" ON "DiasporaWaitlist"("createdAt");
