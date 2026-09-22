import assert from "node:assert/strict";
import test from "node:test";
import { shouldRetryWithAcceptDataLoss } from "./db-push.mjs";

const referenceWarning = `
⚠️  There might be data loss when applying the changes:

  • A unique constraint covering the columns \`[reference]\` on the table \`Payment\` will be added. If there are existing duplicate values, this will fail.

Error: Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --accept-data-loss
`;

test("retries only for the Payment.reference unique index", () => {
  assert.equal(shouldRetryWithAcceptDataLoss(referenceWarning), true);
});

test("does not retry when another data-loss warning is present", () => {
  const extra = referenceWarning.replace(
    "Error:",
    "  • You are about to delete the column `note` on the `Payment` table, which still contains data.\n\nError:",
  );
  assert.equal(shouldRetryWithAcceptDataLoss(extra), false);
});

test("does not retry for a unique index on a different column", () => {
  const other = referenceWarning.replace("[reference]", "[email]").replace("Payment", "User");
  assert.equal(shouldRetryWithAcceptDataLoss(other), false);
});

test("does not retry a connection failure", () => {
  assert.equal(shouldRetryWithAcceptDataLoss("Error: P1001: Can't reach database server"), false);
});
