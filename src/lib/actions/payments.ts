"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FEATURED_DAYS, priceFor } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { field, type ActionState } from "@/lib/validators";

export async function startPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to continue." };

  const product = field(formData, "product");
  const method = field(formData, "method");
  const listingId = field(formData, "listingId");
  if (product !== "featured" && product !== "verified_pro") return { error: "Choose a product." };
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
  }

  let reference = "";
  if (method === "mpesa") {
    const phone = field(formData, "phone").replace(/\s/g, "");
    if (!/^\+?[0-9]{10,15}$/.test(phone)) {
      return { error: "Enter a phone number for the simulated M-Pesa prompt." };
    }
    reference = `DALA-MPESA-${phone.slice(-4)}-${Date.now()}`;
  } else {
    const card = field(formData, "card").replace(/\s/g, "");
    const expiry = field(formData, "expiry").trim();
    const cvc = field(formData, "cvc").trim();
    if (!/^\d{12,19}$/.test(card)) return { error: "Enter a demo card number. Nothing is charged." };
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return { error: "Expiry should look like 12/28." };
    if (!/^\d{3,4}$/.test(cvc)) return { error: "Enter a 3 or 4 digit demo CVC." };
    reference = `DALA-CARD-${card.slice(-4)}-${Date.now()}`;
  }

  const amount = priceFor(product, city);
  await prisma.payment.create({
    data: {
      userId: user.id,
      listingId: linkedListingId,
      product,
      method,
      amount,
      reference,
      status: "paid",
      note: "Simulated checkout. No M-Pesa request and no card charge.",
    },
  });

  if (product === "featured" && linkedListingId) {
    const featuredUntil = new Date(Date.now() + FEATURED_DAYS * 86_400_000);
    await prisma.listing.update({
      where: { id: linkedListingId },
      data: { featured: true, featuredUntil },
    });
    revalidatePath(`/listings/${linkedListingId}`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { verifiedPro: true } });
  }

  revalidatePath("/account");
  revalidatePath("/listings");
  revalidatePath("/");
  redirect("/account?paid=1");
}
