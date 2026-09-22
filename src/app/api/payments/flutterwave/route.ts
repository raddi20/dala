import { NextResponse } from "next/server";
import { paymentConfig } from "@/lib/payments/config";
import { confirmFlutterwavePayment } from "@/lib/payments/confirm";
import { parseWebhook, safeEqual } from "@/lib/payments/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = paymentConfig();
  if (!config.configured || !config.webhookReady) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const raw = await request.text();
  const hash = request.headers.get("verif-hash") ?? "";
  if (!safeEqual(hash, config.webhookHash)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let parsed: ReturnType<typeof parseWebhook>;
  try {
    parsed = parseWebhook(JSON.parse(raw) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!parsed) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  if (parsed.event !== "charge.completed") return NextResponse.json({ received: true, ignored: true });
  if (!parsed.charge) {
    console.error("Flutterwave webhook missing charge fields", parsed.event);
    return NextResponse.json({ error: "Incomplete charge." }, { status: 500 });
  }
  if (parsed.charge.status !== "successful") return NextResponse.json({ received: true, ignored: true });

  const confirmed = await confirmFlutterwavePayment({
    transactionId: parsed.charge.providerId,
    txRef: parsed.charge.reference,
  });
  if (!confirmed.ok && (confirmed.error === "verify_failed" || confirmed.error === "reference_mismatch")) {
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
