"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
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
  if (!parsed.ok) return { error: parsed.error };

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
  if (!parsed.ok) return { error: parsed.error };

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

  await prisma.listing.delete({ where: { id } });
  revalidateListing(id);
  redirect("/account?deleted=1");
}
