import { createHmac, timingSafeEqual } from "node:crypto";

/** Mux rejects a webhook older than this. Matches @mux/mux-node. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SignatureResult = { ok: true } | { ok: false; error: string };

export function muxSignatureHex(timestamp: number, rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function parseSignatureHeader(header: string) {
  let timestamp = -1;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }
  return { timestamp, signatures };
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies a Mux webhook signature (header `mux-signature`, scheme `t=…,v1=…`).
 * `nowMs` is injectable so tests can check the five-minute window.
 */
export function verifyMuxSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  nowMs = Date.now(),
): SignatureResult {
  if (!secret?.trim()) return { ok: false, error: "Webhook secret is not set." };
  if (typeof rawBody !== "string") return { ok: false, error: "Webhook body must be the raw text." };
  if (!header?.trim()) return { ok: false, error: "Missing mux-signature header." };

  const details = parseSignatureHeader(header);
  if (details.timestamp < 0) return { ok: false, error: "Webhook signature has no timestamp." };
  if (details.signatures.length === 0) return { ok: false, error: "Webhook signature has no v1 value." };

  const expected = muxSignatureHex(details.timestamp, rawBody, secret);
  const match = details.signatures.some((signature) => safeEqualHex(signature, expected));
  if (!match) return { ok: false, error: "Webhook signature does not match." };

  const age = Math.floor(nowMs / 1000) - details.timestamp;
  if (age > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, error: "Webhook signature is too old." };
  return { ok: true };
}
