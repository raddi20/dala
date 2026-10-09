-- Additive brochure attribution. Existing accounts stay, with a null code.
ALTER TABLE "User" ADD COLUMN "referralAgentCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referralAgentAt" DATETIME;
