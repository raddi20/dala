"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { commitOccasionCuration } from "@/lib/occasion-curation";
import { OCCASION_DEFINITIONS, ensureOccasionDefinitions, syncListingOccasionSlugs } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

function revalidateOccasion(slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/occasions");
  revalidatePath("/");
  if (slug) revalidatePath(`/occasions/${slug}`);
  for (const item of OCCASION_DEFINITIONS) revalidatePath(`/occasions/${item.slug}`);
}

export async function curateOccasion(formData: FormData) {
  const admin = await requireAdmin();
  const result = await commitOccasionCuration(prisma, {
    role: admin.role,
    action: field(formData, "action"),
    occasionId: field(formData, "occasionId"),
    intro: field(formData, "intro"),
    title: field(formData, "title"),
    storefrontId: field(formData, "storefrontId"),
    listingId: field(formData, "listingId"),
  });
  if (!result.ok) {
    if (result.code === "forbidden") redirect("/");
    redirect("/admin#occasions");
  }
  revalidateOccasion(result.slug);
  redirect("/admin#occasions");
}

export async function setListingOccasions(formData: FormData) {
  const user = await getSessionUser();
  const listingId = field(formData, "listingId");
  if (!user) redirect(`/login?next=/listings/${listingId}/edit`);
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, ownerId: true } });
  if (!listing || (listing.ownerId !== user.id && user.role !== "admin")) redirect("/account");
  if (field(formData, "occasionsPresent") !== "1") redirect(`/listings/${listing.id}/edit`);

  await ensureOccasionDefinitions(prisma);
  const slugs = formData.getAll("occasion").flatMap((value) => (typeof value === "string" ? [value] : []));
  await syncListingOccasionSlugs(prisma, listing.id, slugs);
  revalidateOccasion();
  revalidatePath(`/listings/${listing.id}`);
  revalidatePath(`/listings/${listing.id}/edit`);
  redirect(`/listings/${listing.id}/edit`);
}
