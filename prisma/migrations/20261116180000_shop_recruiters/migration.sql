-- Shop recruiters. Additive only.
-- Existing shops keep recruiterCode null. Nothing is backfilled onto them.
-- Local `npm run db:setup` applies this file (SQLite).
-- The Vercel build applies the same shape with `prisma db push` from schema.prisma,
-- then scripts/backfill-recruiters.ts inserts Irene when that code is missing.

CREATE TABLE "Recruiter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Recruiter_code_key" ON "Recruiter"("code");
CREATE INDEX "Recruiter_active_idx" ON "Recruiter"("active");

ALTER TABLE "Storefront" ADD COLUMN "recruiterCode" TEXT;
CREATE INDEX "Storefront_recruiterCode_idx" ON "Storefront"("recruiterCode");
