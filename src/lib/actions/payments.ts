"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { chargeFor, isPaidProduct } from "@/lib/constants";
import { paymentConfig } from "@/lib/payments/config";
import { createFlutterwaveCheckout } from "@/lib/payments/flutterwave";
import { publicOrigin } from "@/lib/payments/origin";
import { normalizeMpesaPhone } from "@/lib/payments/rules";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { field, type ActionState } from "@/lib/validators";

export async function startPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to continue." };

  const config = paymentConfig();
  if (!config.configured) {
    return {
      error:
        config.mode === "invalid"
          ? "FLW_SECRET_KEY is set, but it is not a Flutterwave secret key."
          : "Add a Flutterwave secret key before checkout. The steps are on this page.",
    };
  }

  const product = field(formData, "product");
  const method = field(formData, "method");
  const listingId = field(formData, "listingId");
  if (!isPaidProduct(product)) return { error: "Choose a product." };
  if (method !== "mpesa" && method !== "card") return { error: "Choose a payment method." };

  let city = user.city;
  let linkedListingId: string | null = null;
  if (product === "featured") {
    if (!listingId) return { error: "Choose a listing to feature." };
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || (listing.ownerId !== user.id && user.role !== "admin")) {
      return { error: "Listing not found." };
    }
    city = listing.city;
    linkedListingId = listing.id;
  } else if (user.verifiedPro) {
    return { error: "You already have Verified Pro." };
  }

  const charge = chargeFor(product, city);
  if (method === "mpesa" && charge.currency !== "KES") {
    return { error: "M-Pesa only charges Kenyan shillings. Choose card for this price." };
  }

  let phone = "";
  if (method === "mpesa") {
    const normalized = normalizeMpesaPhone(field(formData, "phone"));
    if (!normalized) return { error: "Enter a Safaricom number, like 2547… or 07…." };
    phone = normalized;
  }

  const reference = `dala_${randomBytes(12).toString("hex")}`;
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      listingId: linkedListingId,
      product,
      method,
      amount: charge.label,
      amountValue: charge.amount,
      currency: charge.currency,
      reference,
      provider: "flutterwave",
      status: "pending",
      note: config.testMode ? "Test mode. Waiting for Flutterwave." : "Waiting for Flutterwave.",
    },
  });

  const origin = await publicOrigin();
  const checkout = await createFlutterwaveCheckout({
    secret: config.secret,
    txRef: reference,
    amount: charge.amount,
    currency: charge.currency,
    redirectUrl: `${origin}/upgrade/return`,
    paymentOption: method,
    email: user.email,
    name: user.name,
    phone,
    description: product === "featured" ? "Featured listing for 30 days" : "Verified Pro",
    meta: {
      payment_id: payment.id,
      product,
      user_id: user.id,
      listing_id: linkedListingId ?? "",
    },
  });

  if (!checkout.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "failed", note: checkout.error.slice(0, 240) },
    });
    return { error: checkout.error };
  }

  redirect(checkout.link);
}
