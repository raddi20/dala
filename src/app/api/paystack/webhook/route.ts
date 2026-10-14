import { NextResponse } from "next/server";
import { applyPaid, paystackSignatureOk, protectedOrdersOn, readChargeSuccess } from "@/lib/protected-order";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!protectedOrdersOn()) return NextResponse.json({ ok: true, ignored: true });
  const secret = (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!paystackSignatureOk(raw, signature, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const charge = readChargeSuccess(payload);
  if (!charge) return NextResponse.json({ ok: true, ignored: true });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.paystackEvent.create({ data: { id: charge.eventId, reference: charge.reference } });
      const order = await tx.order.findUnique({ where: { paystackReference: charge.reference } });
      if (!order) return;
      const applied = applyPaid(order, charge, false, new Date());
      if (!applied.changed || !applied.paidAt) return;
      await tx.order.update({
        where: { id: order.id },
        data: { status: applied.status, paidAt: applied.paidAt },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, status: applied.status, note: applied.note },
      });
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
    console.error("Paystack webhook failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
