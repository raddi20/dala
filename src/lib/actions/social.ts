"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { safePath } from "@/lib/utils";
import { field, reportSchema, reviewSchema, type ActionState } from "@/lib/validators";

export async function createReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to review." };

  const parsed = reviewSchema.safeParse({
    listingId: field(formData, "listingId"),
    rating: field(formData, "rating"),
    body: field(formData, "body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the review." };
  }

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing || listing.hidden) return { error: "Listing not found." };
  if (listing.ownerId === user.id) return { error: "You can't review your own listing." };

  await prisma.review.upsert({
    where: { listingId_authorId: { listingId: listing.id, authorId: user.id } },
    create: {
      listingId: listing.id,
      authorId: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
    update: { rating: parsed.data.rating, body: parsed.data.body, hidden: false },
  });

  revalidatePath(`/listings/${listing.id}`);
  revalidatePath("/listings");
  redirect(`/listings/${listing.id}#reviews`);
}

export async function createReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to report." };

  const parsed = reportSchema.safeParse({
    listingId: field(formData, "listingId"),
    targetUserId: field(formData, "targetUserId"),
    reason: field(formData, "reason"),
    details: field(formData, "details"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the report." };
  }
  if (!parsed.data.listingId && !parsed.data.targetUserId) {
    return { error: "Nothing to report." };
  }
  if (parsed.data.targetUserId === user.id) return { error: "You can't report yourself." };

  await prisma.report.create({
    data: {
      reporterId: user.id,
      listingId: parsed.data.listingId || null,
      targetUserId: parsed.data.targetUserId || null,
      reason: parsed.data.reason,
      details: parsed.data.details,
    },
  });

  revalidatePath("/admin");
  return { error: "", ok: true };
}

export async function blockUser(formData: FormData) {
  const user = await getSessionUser();
  const returnTo = safePath(field(formData, "returnTo"), "/");
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  const blockedId = field(formData, "userId");
  if (!blockedId || blockedId === user.id) redirect(returnTo);

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) redirect(returnTo);

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
    create: { blockerId: user.id, blockedId },
    update: {},
  });

  revalidatePath("/listings");
  revalidatePath("/account");
  redirect(returnTo);
}

export async function unblockUser(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const blockedId = field(formData, "userId");
  await prisma.block.deleteMany({ where: { blockerId: user.id, blockedId } });
  revalidatePath("/listings");
  revalidatePath("/account");
  redirect("/account");
}
