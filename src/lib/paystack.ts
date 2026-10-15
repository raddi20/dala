import {
  paystackInitializeRequest,
  paystackRefundRequest,
  type PaystackInitialize,
} from "@/lib/protected-order";

type Fetcher = (url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export async function initialiseTransaction(
  request: PaystackInitialize,
  fetchImpl: Fetcher,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const payload = await response.json().catch(() => null);
  const data = payload && typeof payload === "object" ? (payload as { status?: unknown; data?: { authorization_url?: unknown } }) : null;
  const url = data?.data?.authorization_url;
  if (!response.ok || data?.status !== true || typeof url !== "string" || !url) {
    return { ok: false, message: "Paystack did not start the payment. Nothing was taken." };
  }
  return { ok: true, url };
}

export async function refundTransaction(
  input: { secret: string; reference: string },
  fetchImpl: Fetcher,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const request = paystackRefundRequest(input);
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const payload = await response.json().catch(() => null);
  const status = payload && typeof payload === "object" ? (payload as { status?: unknown }).status : false;
  if (!response.ok || status !== true) return { ok: false, message: "Paystack did not queue the refund." };
  return { ok: true };
}

export function initializeCall(input: Parameters<typeof paystackInitializeRequest>[0]) {
  return paystackInitializeRequest(input);
}
