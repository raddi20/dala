import type { Metadata } from "next";
import { confirmFlutterwavePayment } from "@/lib/payments/confirm";
import { markPaymentCancelled } from "@/lib/payments/fulfill";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { one } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Confirming payment" };

export default async function UpgradeReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = one(sp.status).toLowerCase();
  const txRef = one(sp.tx_ref);
  const transactionId = one(sp.transaction_id);
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (txRef) params.set("tx_ref", txRef);
  if (transactionId) params.set("transaction_id", transactionId);
  const next = params.size ? `/upgrade/return?${params}` : "/upgrade";
  const user = await requireUser(next);

  if (!txRef) redirect("/upgrade");

  const payment = await prisma.payment.findUnique({ where: { reference: txRef } });
  if (!payment || payment.userId !== user.id) redirect("/account");
  if (payment.status === "paid") redirect("/account?paid=1");

  const shouldVerify = Boolean(transactionId) || status === "successful" || status === "completed";
  if (shouldVerify) {
    const confirmed = await confirmFlutterwavePayment({ transactionId, txRef });
    if (confirmed.ok) redirect("/account?paid=1");
    if (confirmed.error === "mismatch") redirect("/account?paid=failed");
    if (confirmed.error === "not_successful" && status !== "cancelled" && status !== "failed") {
      redirect("/account?paid=pending");
    }
  }

  if (status === "cancelled" || status === "failed") {
    await markPaymentCancelled(txRef, user.id);
    redirect(status === "failed" ? "/account?paid=failed" : "/account?paid=cancelled");
  }

  redirect("/account?paid=pending");
}
