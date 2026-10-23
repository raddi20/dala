"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { scheduleListingModeration } from "@/lib/ai/moderation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { deletedListingNote } from "@/lib/report-keep";
import { assessScam } from "@/lib/scam";
import { regionForCity } from "@/lib/constants";
import { field, parseListingForm, type ActionState } from "@/lib/validators";

function revalidateListing(id: string) {
  revalidatePath("/");
  revalidatePath("/listings");
  revalidatePath(`/listings/${id}`);
  revalidatePath("/account");
  revalidatePath("/admin");
}

export async function createListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to post a listing." };

  const parsed = parseListingForm(formData);
  if (!parsed.ok) return { error: parsed.error, field: parsed.field };

  const risk = assessScam(parsed.data);
  const listing = await prisma.listing.create({
    data: {
      ...parsed.data,
      region: regionForCity(parsed.data.city),
      scamRisk: risk.level,
      scamNotes: risk.notes,
      ownerId: user.id,
      contactName: parsed.data.contactName || user.name,
    },
  });

  scheduleListingModeration(listing.id);
  revalidateListing(listing.id);
  redirect(`/listings/${listing.id}?posted=1`);
}

export async function updateListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to edit a listing." };

  const id = field(formData, "id");
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || (existing.ownerId !== user.id && user.role !== "admin")) {
    return { error: "Listing not found." };
  }

  const parsed = parseListingForm(formData);
  if (!parsed.ok) return { error: parsed.error, field: parsed.field };

  const risk = assessScam(parsed.data);
  await prisma.listing.update({
    where: { id },
    data: {
      ...parsed.data,
      region: regionForCity(parsed.data.city),
      scamRisk: risk.level,
      scamNotes: risk.notes,
    },
  });

  scheduleListingModeration(id);
  revalidateListing(id);
  redirect(`/listings/${id}?updated=1`);
}

export async function deleteListing(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");

  const id = field(formData, "id");
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || (existing.ownerId !== user.id && user.role !== "admin")) {
    redirect("/account");
  }

  // Reports on a listing used to cascade away with it. Keep them for the admin queue, noting what was deleted.
  await prisma.$transaction(async (tx) => {
    const reports = await tx.report.findMany({ where: { listingId: id }, select: { id: true, details: true } });
    for (const report of reports) {
      await tx.report.update({
        where: { id: report.id },
        data: { listingId: null, details: deletedListingNote(existing.title, report.details) },
      });
    }
    await tx.listing.delete({ where: { id } });
  });
  revalidateListing(id);
  redirect("/account?deleted=1");
}
