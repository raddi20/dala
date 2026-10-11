"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OCCASION_DEFINITIONS } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { commitShopBadgeChange } from "@/lib/shop-badge-commit";
import { shopBadgeDefinition, shopBadgeMethodLabel } from "@/lib/shop-badges";
import { requireAdmin } from "@/lib/session";
import {
  reasonOrDefault,
  requiredReason,
  setListingFeaturedState,
  setListingHiddenState,
  setListingVerifiedState,
  setOfferingHiddenState,
  setReviewHiddenState,
  setShopDiasporaState,
  setShopHiddenState,
  setUserProState,
  setUserSuspendedState,
  writeAdminAudit,
  type AdminActor,
} from "@/lib/moderation";
import { field } from "@/lib/validators";

function refresh(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/listings");
  revalidatePath("/");
  revalidatePath("/occasions");
  revalidatePath("/categories");
  revalidatePath("/sitemap.xml");
  for (const item of OCCASION_DEFINITIONS) revalidatePath(`/occasions/${item.slug}`);
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

function actorOf(admin: { id: string; email: string; name: string }): AdminActor {
  return { id: admin.id, email: admin.email, name: admin.name };
}

function needReason(formData: FormData): string {
  const reason = requiredReason(field(formData, "reason"));
  if (!reason) redirect("/admin?moderation=reason");
  return reason;
}

export async function setListingHidden(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const hidden = field(formData, "hidden") === "1";
  const result = await setListingHiddenState(actorOf(admin), id, hidden, needReason(formData));
  if (!result.ok) redirect("/admin?moderation=missing");
  refresh(id);
}

export async function setListingVerified(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const verified = field(formData, "verified") === "1";
  const reason = reasonOrDefault(field(formData, "reason"), verified ? "Grant verified" : "Remove verified");
  const result = await setListingVerifiedState(actorOf(admin), id, verified, reason);
  if (!result.ok) redirect("/admin?moderation=missing");
  refresh(id);
}

export async function setListingFeatured(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const featured = field(formData, "featured") === "1";
  const reason = reasonOrDefault(field(formData, "reason"), featured ? "Feature listing" : "Remove featured");
  const result = await setListingFeaturedState(actorOf(admin), id, featured, reason);
  if (!result.ok) redirect("/admin?moderation=missing");
  refresh(id);
}

export async function setShopHidden(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "storefrontId");
  const hidden = field(formData, "hidden") === "1";
  const result = await setShopHiddenState(actorOf(admin), id, hidden, needReason(formData));
  if (!result.ok) redirect("/admin?moderation=missing");
  await refreshShop(result.userId, result.slug);
}

export async function setOfferingHidden(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "offeringId");
  const hidden = field(formData, "hidden") === "1";
  const result = await setOfferingHiddenState(actorOf(admin), id, hidden, needReason(formData));
  if (!result.ok) redirect("/admin?moderation=missing");
  await refreshShop(result.userId, result.slug);
}

export async function setReviewHidden(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "reviewId");
  const hidden = field(formData, "hidden") === "1";
  const result = await setReviewHiddenState(actorOf(admin), id, hidden, needReason(formData));
  if (!result.ok) redirect("/admin?moderation=missing");
  refresh(result.listingId);
}

export async function setUserSuspended(formData: FormData) {
  const admin = await requireAdmin();
  const userId = field(formData, "userId");
  const suspended = field(formData, "suspended") === "1";
  const result = await setUserSuspendedState(actorOf(admin), userId, suspended, needReason(formData));
  if (!result.ok) redirect(result.code === "self" ? "/admin?moderation=self" : "/admin?moderation=missing");
  if (result.slug) await refreshShop(result.userId, result.slug);
  else {
    refresh();
    revalidatePath(`/people/${result.userId}`);
  }
}

export async function setVerifiedPro(formData: FormData) {
  const admin = await requireAdmin();
  const userId = field(formData, "userId");
  const grant = field(formData, "value") === "1";
  const fallback = grant ? "Grant or add Pro plan" : "Remove Pro plan";
  const result = await setUserProState(actorOf(admin), userId, grant, reasonOrDefault(field(formData, "reason"), fallback));
  if (!result.ok) redirect("/admin?moderation=missing");
  refresh();
  revalidatePath(`/people/${userId}`);
  revalidatePath("/account");
  revalidatePath("/account/storefront");
  revalidatePath("/upgrade");
  if (result.slug) revalidatePath(`/b/${result.slug}`);
}

export async function setServesDiaspora(formData: FormData) {
  const admin = await requireAdmin();
  const storefrontId = field(formData, "storefrontId");
  const servesDiaspora = field(formData, "value") === "1";
  const reason = reasonOrDefault(
    field(formData, "reason"),
    servesDiaspora ? "Turn on diaspora orders" : "Turn off diaspora orders",
  );
  const result = await setShopDiasporaState(actorOf(admin), storefrontId, servesDiaspora, reason);
  if (!result.ok) redirect("/admin?moderation=missing");
  await refreshShop(result.userId, result.slug);
}

export async function setShopBadge(formData: FormData) {
  const admin = await requireAdmin();
  const storefrontId = field(formData, "storefrontId");
  const badge = field(formData, "badge");
  const action = field(formData, "action");
  const note = field(formData, "note");
  const result = await commitShopBadgeChange(prisma, {
    role: admin.role,
    storefrontId,
    badge,
    action,
    method: field(formData, "method"),
    note,
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
  if (!result.ok) {
    if (result.code === "forbidden") redirect("/");
    return;
  }
  if (!result.unchanged) {
    const defined = shopBadgeDefinition(badge);
    const label = defined?.label ?? badge;
    const method = action === "grant" ? shopBadgeMethodLabel(field(formData, "method")) : "";
    const reason = reasonOrDefault(note, action === "grant" ? `Grant ${label}${method ? ` (${method})` : ""}` : `Remove ${label}`);
    await writeAdminAudit({
      actor: actorOf(admin),
      action: action === "remove" ? "badge.remove" : "badge.grant",
      targetType: "shop",
      targetId: storefrontId,
      reason,
    });
  }
  await refreshShop(result.userId, result.slug);
}

export async function resolveReport(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const status = field(formData, "status") === "dismissed" ? "dismissed" : "actioned";
  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, listingId: true, reason: true } });
  if (!report) redirect("/admin?moderation=missing");
  const hide = field(formData, "hide") === "1" && Boolean(report.listingId);
  await prisma.report.update({ where: { id }, data: { status } });
  await writeAdminAudit({
    actor: actorOf(admin),
    action: status === "dismissed" ? "report.dismiss" : "report.action",
    targetType: "report",
    targetId: id,
    reason: reasonOrDefault(report.reason, status === "dismissed" ? "Dismiss report" : "Action report"),
  });
  if (hide && report.listingId) {
    await setListingHiddenState(actorOf(admin), report.listingId, true, reasonOrDefault(report.reason, "Hide listing from report"));
    refresh(report.listingId);
    return;
  }
  refresh(report.listingId ?? undefined);
}
