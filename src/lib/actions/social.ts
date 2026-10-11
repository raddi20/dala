"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  consumeFixedWindow,
  REPORT_LIMIT,
  REPORT_LIMIT_MESSAGE,
  REPORT_WINDOW_MS,
  REVIEW_LIMIT,
  REVIEW_LIMIT_MESSAGE,
  REVIEW_WINDOW_MS,
} from "@/lib/rate-limit";
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

  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { owner: { select: { suspended: true } } },
  });
  if (!listing || listing.hidden || listing.owner.suspended) return { error: "Listing not found." };
  if (listing.ownerId === user.id) return { error: "You can't review your own listing." };

  const gate = await consumeFixedWindow({
    action: "review",
    subject: user.id,
    limit: REVIEW_LIMIT,
    windowMs: REVIEW_WINDOW_MS,
  });
  if (gate.limited) return { error: REVIEW_LIMIT_MESSAGE };

  const existing = await prisma.review.findUnique({
    where: { listingId_authorId: { listingId: listing.id, authorId: user.id } },
    select: { hidden: true },
  });
  if (existing?.hidden) return { error: "A moderator hid this review, so it stays hidden." };

  await prisma.review.upsert({
    where: { listingId_authorId: { listingId: listing.id, authorId: user.id } },
    create: {
      listingId: listing.id,
      authorId: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
    update: { rating: parsed.data.rating, body: parsed.data.body },
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

  const gate = await consumeFixedWindow({
    action: "report",
    subject: user.id,
    limit: REPORT_LIMIT,
    windowMs: REPORT_WINDOW_MS,
  });
  if (gate.limited) return { error: REPORT_LIMIT_MESSAGE };

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
