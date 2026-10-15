-- Shop interest in Rangach Business. New table only. No IP column. agentCode stays null when there is no brochure code.

CREATE TABLE "BusinessLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNotes" TEXT NOT NULL DEFAULT '',
    "refCode" TEXT NOT NULL DEFAULT '',
    "agentCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "BusinessLead_status_createdAt_idx" ON "BusinessLead"("status", "createdAt");
CREATE INDEX "BusinessLead_createdAt_idx" ON "BusinessLead"("createdAt");
