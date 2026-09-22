import "server-only";
import { paymentConfig } from "@/lib/payments/config";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { fulfillPaidPayment, type FulfillResult } from "@/lib/payments/fulfill";

export type ConfirmResult = FulfillResult | { ok: false; error: "not_configured" | "verify_failed" | "not_successful" | "reference_mismatch" };

/** Verifies a Flutterwave transaction, then applies the upgrade once. */
export async function confirmFlutterwavePayment(input: {
  transactionId?: string;
  txRef: string;
}): Promise<ConfirmResult> {
  const config = paymentConfig();
  if (!config.configured) return { ok: false, error: "not_configured" };

  const verified = await verifyFlutterwaveTransaction({
    secret: config.secret,
    transactionId: input.transactionId,
    txRef: input.txRef,
  });
  if (!verified.ok) return verified;
  if (verified.charge.status !== "successful") return { ok: false, error: "not_successful" };

  return fulfillPaidPayment({
    reference: verified.charge.reference,
    providerId: verified.charge.providerId,
    amount: verified.charge.amount,
    currency: verified.charge.currency,
    method: verified.charge.method,
    testMode: config.testMode,
  });
}
