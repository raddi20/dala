"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { commitShopBadgeChange } from "@/lib/shop-badge-commit";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

function refresh(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/listings");
  revalidatePath("/");
  if (id) revalidatePath(`/listings/${id}`);
}

async function refreshShop(userId: string, slug: string) {
  refresh();
  revalidatePath(`/b/${slug}`);
  revalidatePath(`/people/${userId}`);
  revalidatePath("/account");
  revalidatePath("/account/storefront");
  const listings = await prisma.listing.findMany({ where: { ownerId: userId }, select: { id: true } });
  for (const listing of listings) revalidatePath(`/listings/${listing.id}`);
}

export async function setListingHidden(formData: FormData) {
  await requireAdmin();
  const id = field(formData, "id");
  const hidden = field(formData, "hidden") === "1";
  await prisma.listing.update({ where: { id }, data: { hidden } });
  refresh(id);
}

export async function setListingVerified(formData: FormData) {
  await requireAdmin();
  const id = field(formData, "id");
  const verified = field(formData, "verified") === "1";
  await prisma.listing.update({ where: { id }, data: { verified } });
  refresh(id);
}

export async function setVerifiedPro(formData: FormData) {
  await requireAdmin();
  const userId = field(formData, "userId");
  const verifiedPro = field(formData, "value") === "1";
  await prisma.user.update({ where: { id: userId }, data: { verifiedPro } });
  refresh();
}

export async function setShopBadge(formData: FormData) {
  const admin = await requireAdmin();
  const result = await commitShopBadgeChange(prisma, {
    role: admin.role,
    storefrontId: field(formData, "storefrontId"),
    badge: field(formData, "badge"),
    action: field(formData, "action"),
    method: field(formData, "method"),
    note: field(formData, "note"),
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
  if (!result.ok) {
    if (result.code === "forbidden") redirect("/");
    return;
  }
  await refreshShop(result.userId, result.slug);
}

export async function resolveReport(formData: FormData) {
  await requireAdmin();
  const id = field(formData, "id");
  const status = field(formData, "status") === "dismissed" ? "dismissed" : "actioned";
  const report = await prisma.report.update({ where: { id }, data: { status } });
  if (field(formData, "hide") === "1" && report.listingId) {
    await prisma.listing.update({ where: { id: report.listingId }, data: { hidden: true } });
    refresh(report.listingId);
    return;
  }
  refresh(report.listingId ?? undefined);
}
