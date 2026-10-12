"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyStoredPhones } from "@/lib/phone-cleanup";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function applyPhoneNumbers() {
  const admin = await requireAdmin("/admin/phones");
  const result = await applyStoredPhones(prisma, {
    id: admin.id,
    email: admin.email,
    name: admin.name,
  });
  revalidatePath("/admin/phones");
  revalidatePath("/admin");
  const changed = result.plans.filter((plan) => plan.changed);
  const userIds = changed.filter((plan) => plan.kind === "user").map((plan) => plan.id);
  const listingIds = changed.filter((plan) => plan.kind === "listing").map((plan) => plan.id);
  const listings = listingIds.length
    ? await prisma.listing.findMany({ where: { id: { in: listingIds } }, select: { id: true, ownerId: true } })
    : [];
  const ownerIds = [...new Set([...userIds, ...listings.map((listing) => listing.ownerId)])];
  const shops = ownerIds.length
    ? await prisma.storefront.findMany({ where: { userId: { in: ownerIds } }, select: { slug: true } })
    : [];
  for (const listing of listings) revalidatePath(`/listings/${listing.id}`);
  for (const userId of ownerIds) revalidatePath(`/people/${userId}`);
  for (const shop of shops) revalidatePath(`/b/${shop.slug}`);
  redirect(`/admin/phones?applied=${result.written}`);
}
