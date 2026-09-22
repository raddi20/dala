import { revalidatePath } from "next/cache";
import { FEATURED_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { amountsMatch } from "@/lib/payments/rules";

export type FulfillResult = { ok: true; already: boolean } | { ok: false; error: "unknown" | "mismatch" };

async function refreshPaid(payment: { userId: string; listingId: string | null; product: string }) {
  const paths = ["/", "/listings", "/account", "/account/storefront", "/upgrade", `/people/${payment.userId}`];
  if (payment.listingId) paths.push(`/listings/${payment.listingId}`);
  if (payment.product === "verified_pro") {
    const shop = await prisma.storefront.findUnique({
      where: { userId: payment.userId },
      select: { slug: true },
    });
    if (shop) paths.push(`/b/${shop.slug}`);
  }
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("static generation store missing")) continue;
      console.error("revalidatePath failed", path, message);
    }
  }
}

/**
 * Marks a pending checkout paid and applies Featured or Verified Pro.
 * A repeat call for the same reference does not extend the featured window again.
 */
export async function fulfillPaidPayment(input: {
  reference: string;
  providerId: string;
  amount: number;
  currency: string;
  method: "mpesa" | "card" | "";
  testMode: boolean;
}): Promise<FulfillResult> {
  const payment = await prisma.payment.findUnique({ where: { reference: input.reference } });
  if (!payment) return { ok: false, error: "unknown" };
  if (payment.status === "paid") return { ok: true, already: true };

  const currency = input.currency.toUpperCase();
  if (payment.currency.toUpperCase() !== currency || !amountsMatch(payment.amountValue, input.amount)) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "paid" } },
      data: {
        status: "failed",
        providerId: input.providerId,
        note: "Flutterwave confirmed a different amount or currency, so nothing was upgraded.",
      },
    });
    return { ok: false, error: "mismatch" };
  }

  const note = input.testMode
    ? "Flutterwave test payment. No live M-Pesa prompt and no live card charge."
    : "Paid with Flutterwave.";

  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "paid" } },
      data: {
        status: "paid",
        providerId: input.providerId,
        method: input.method || payment.method,
        note,
      },
    });
    if (updated.count !== 1) return false;

    if (payment.product === "featured" && payment.listingId) {
      const listing = await tx.listing.findUnique({ where: { id: payment.listingId }, select: { id: true } });
      if (listing) {
        const featuredUntil = new Date(Date.now() + FEATURED_DAYS * 86_400_000);
        await tx.listing.update({
          where: { id: listing.id },
          data: { featured: true, featuredUntil },
        });
      }
    } else if (payment.product === "verified_pro") {
      await tx.user.update({ where: { id: payment.userId }, data: { verifiedPro: true } });
    }
    return true;
  });

  await refreshPaid(payment);
  if (!claimed) return { ok: true, already: true };
  return { ok: true, already: false };
}

export async function markPaymentCancelled(reference: string, userId: string) {
  await prisma.payment.updateMany({
    where: { reference, userId, status: "pending" },
    data: { status: "cancelled", note: "Checkout cancelled before Flutterwave confirmed payment." },
  });
  try {
    revalidatePath("/account");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("static generation store missing")) console.error("revalidatePath failed", message);
  }
}
