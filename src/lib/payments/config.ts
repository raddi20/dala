import "server-only";
import { classifySecret, type PaymentMode } from "@/lib/payments/rules";

export function paymentConfig() {
  const secret = process.env.FLW_SECRET_KEY?.trim() ?? "";
  const webhookHash = process.env.FLW_WEBHOOK_HASH?.trim() ?? "";
  const mode: PaymentMode = classifySecret(secret);
  return {
    secret,
    webhookHash,
    mode,
    configured: mode === "test" || mode === "live",
    testMode: mode === "test",
    webhookReady: webhookHash.length > 0,
  };
}
