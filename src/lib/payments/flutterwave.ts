import "server-only";
import { isFlutterwaveCheckoutUrl, parseVerifyBody, type ParsedCharge } from "@/lib/payments/rules";

const API = "https://api.flutterwave.com/v3";

type CheckoutInput = {
  secret: string;
  txRef: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  paymentOption: "mpesa" | "card";
  email: string;
  name: string;
  phone: string;
  description: string;
  meta: Record<string, string>;
};

export type CheckoutResult = { ok: true; link: string } | { ok: false; error: string };

function publicError(message: string) {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return "Flutterwave could not start checkout.";
  if (/email/i.test(text)) {
    return "Flutterwave rejected the email on this account. Demo addresses ending in @dala.local are local only — use a real email.";
  }
  if (/authoriz|invalid key|secret key/i.test(text)) {
    return "Flutterwave rejected the secret key. Check FLW_SECRET_KEY and try again.";
  }
  if (text.length > 180) return "Flutterwave could not start checkout.";
  return text;
}

export async function createFlutterwaveCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  let response: Response;
  try {
    response = await fetch(`${API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.redirectUrl,
        // Honoured when preferred payment methods are enabled in the Flutterwave dashboard.
        payment_options: input.paymentOption,
        customer: {
          email: input.email,
          name: input.name,
          phonenumber: input.phone || undefined,
        },
        customizations: {
          title: "Dala",
          description: input.description,
        },
        meta: input.meta,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("Flutterwave checkout request failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "Could not reach Flutterwave. Try again." };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const link = typeof data.link === "string" ? data.link : "";
  const message = typeof row.message === "string" ? row.message : "";

  if (!response.ok || row.status !== "success" || !isFlutterwaveCheckoutUrl(link)) {
    console.error("Flutterwave checkout rejected", { status: response.status, message });
    return { ok: false, error: publicError(message) };
  }
  return { ok: true, link };
}

export async function verifyFlutterwaveTransaction(input: {
  secret: string;
  transactionId?: string;
  txRef: string;
}): Promise<{ ok: true; charge: ParsedCharge } | { ok: false; error: "verify_failed" | "reference_mismatch" }> {
  const transactionId = input.transactionId?.trim() ?? "";
  const path = /^\d+$/.test(transactionId)
    ? `${API}/transactions/${transactionId}/verify`
    : `${API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.txRef)}`;

  let response: Response;
  try {
    response = await fetch(path, {
      headers: { Authorization: `Bearer ${input.secret}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Flutterwave verify request failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "verify_failed" };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const charge = parseVerifyBody(body);
  if (!response.ok || !charge) {
    console.error("Flutterwave verify rejected", { status: response.status });
    return { ok: false, error: "verify_failed" };
  }
  if (charge.reference !== input.txRef) {
    console.error("Flutterwave verify reference mismatch");
    return { ok: false, error: "reference_mismatch" };
  }
  return { ok: true, charge };
}
