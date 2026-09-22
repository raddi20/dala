import { timingSafeEqual } from "node:crypto";

export type PaymentMode = "missing" | "invalid" | "test" | "live";

/** Test keys start with FLWSECK_TEST. Live keys start with FLWSECK-. */
export function classifySecret(secret: string): PaymentMode {
  const value = secret.trim();
  if (!value) return "missing";
  if (value.startsWith("FLWSECK_TEST")) return "test";
  if (value.startsWith("FLWSECK-")) return "live";
  return "invalid";
}

/** Safaricom numbers as 2547… or 2541… (12 digits). */
export function normalizeMpesaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

export function amountsMatch(expectedMajor: number, actualMajor: number) {
  return Number.isFinite(actualMajor) && Math.abs(expectedMajor - actualMajor) < 0.001;
}

export function safeEqual(left: string, right: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isFlutterwaveCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "checkout.flutterwave.com" || url.hostname.endsWith(".flutterwave.com"))
    );
  } catch {
    return false;
  }
}

export type ParsedCharge = {
  reference: string;
  amount: number;
  currency: string;
  providerId: string;
  status: "successful" | "pending" | "failed" | "other";
  method: "mpesa" | "card" | "";
};

function readAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readStatus(value: unknown): ParsedCharge["status"] {
  if (value === "successful" || value === "pending" || value === "failed") return value;
  return "other";
}

function readMethod(value: unknown): ParsedCharge["method"] {
  if (typeof value !== "string") return "";
  const method = value.toLowerCase();
  if (method === "mpesa" || method.includes("mpesa") || method === "mobilemoney") return "mpesa";
  if (method === "card") return "card";
  return "";
}

export function parseCharge(data: unknown): ParsedCharge | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const reference = typeof row.tx_ref === "string" ? row.tx_ref : "";
  const amount = readAmount(row.amount);
  const currency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
  const id = row.id;
  const providerId = typeof id === "number" || (typeof id === "string" && id.trim()) ? String(id).trim() : "";
  if (!reference || amount === null || !currency || !providerId) return null;
  return {
    reference,
    amount,
    currency,
    providerId,
    status: readStatus(typeof row.status === "string" ? row.status.toLowerCase() : ""),
    method: readMethod(row.payment_type),
  };
}

/** Envelope from GET /transactions/:id/verify. `status: success` means the lookup worked. */
export function parseVerifyBody(body: unknown): ParsedCharge | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.status !== "success") return null;
  return parseCharge(row.data);
}

export function parseWebhook(body: unknown): { event: string; charge: ParsedCharge | null } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (typeof row.event !== "string" || !row.event) return null;
  return { event: row.event, charge: parseCharge(row.data) };
}
