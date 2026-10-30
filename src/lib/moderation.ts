import { FEATURED_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { isProActive, setUserPro } from "@/lib/pro";

export type AdminActor = { id: string; email: string; name: string };

export const REASON_TOO_SHORT = "Write a short reason (at least 3 characters).";
export const CANNOT_SUSPEND_SELF = "You can't suspend your own account.";

/** Query-code messages for /admin?moderation=. Kept out of the server-action module. */
export const MODERATION_NOTICES: Record<string, string> = {
  reason: REASON_TOO_SHORT,
  self: CANNOT_SUSPEND_SELF,
  missing: "That record is no longer there.",
};

const REASON_MAX = 500;

export function requiredReason(raw: string): string | null {
  const reason = raw.trim().replace(/\s+/g, " ");
  if (reason.length < 3 || reason.length > REASON_MAX) return null;
  return reason;
}

export function reasonOrDefault(raw: string, fallback: string): string {
  const reason = raw.trim().replace(/\s+/g, " ");
  if (!reason) return fallback.slice(0, REASON_MAX);
  return reason.slice(0, REASON_MAX);
}

type AuditInput = {
  actor: AdminActor;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
};

export async function writeAdminAudit(entry: AuditInput, db: Pick<typeof prisma, "adminAuditLog"> = prisma) {
  await db.adminAuditLog.create({
    data: {
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      actorName: entry.actor.name,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason.slice(0, REASON_MAX),
    },
  });
}

export async function setListingHiddenState(actor: AdminActor, id: string, hidden: boolean, reason: string) {
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return { ok: false as const, code: "missing" as const };
  const now = new Date();
  await prisma.$transaction([
    prisma.listing.update({
      where: { id },
      data: hidden ? { hidden: true, hiddenReason: reason, hiddenAt: now } : { hidden: false, hiddenReason: "", hiddenAt: null },
    }),
    prisma.adminAuditLog.create({
      data: auditData(actor, hidden ? "listing.hide" : "listing.restore", "listing", id, reason),
    }),
  ]);
  return { ok: true as const, id };
}

export async function setListingVerifiedState(actor: AdminActor, id: string, verified: boolean, reason: string) {
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return { ok: false as const, code: "missing" as const };
  await prisma.$transaction([
    prisma.listing.update({ where: { id }, data: { verified } }),
    prisma.adminAuditLog.create({
      data: auditData(actor, verified ? "listing.verify" : "listing.unverify", "listing", id, reason),
    }),
  ]);
  return { ok: true as const, id };
}

export async function setListingFeaturedState(actor: AdminActor, id: string, featured: boolean, reason: string, now = new Date()) {
  const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
  if (!listing) return { ok: false as const, code: "missing" as const };
  const featuredUntil = featured ? new Date(now.getTime() + FEATURED_DAYS * 86_400_000) : null;
  await prisma.$transaction([
    prisma.listing.update({
      where: { id },
      data: { featured, featuredUntil },
    }),
    prisma.adminAuditLog.create({
      data: auditData(actor, featured ? "listing.feature" : "listing.unfeature", "listing", id, reason),
    }),
  ]);
  return { ok: true as const, id };
}

export async function setShopHiddenState(actor: AdminActor, id: string, hidden: boolean, reason: string) {
  const shop = await prisma.storefront.findUnique({ where: { id }, select: { id: true, slug: true, userId: true } });
  if (!shop) return { ok: false as const, code: "missing" as const };
  const now = new Date();
  await prisma.$transaction([
    prisma.storefront.update({
      where: { id },
      data: hidden ? { hidden: true, hiddenReason: reason, hiddenAt: now } : { hidden: false, hiddenReason: "", hiddenAt: null },
    }),
    prisma.adminAuditLog.create({
      data: auditData(actor, hidden ? "shop.hide" : "shop.restore", "shop", id, reason),
    }),
  ]);
  return { ok: true as const, id, slug: shop.slug, userId: shop.userId };
}

export async function setOfferingHiddenState(actor: AdminActor, id: string, hidden: boolean, reason: string) {
  const offering = await prisma.offering.findUnique({
    where: { id },
    select: { id: true, storefront: { select: { slug: true, userId: true } } },
  });
  if (!offering) return { ok: false as const, code: "missing" as const };
  const now = new Date();
  await prisma.$transaction([
    prisma.offering.update({
      where: { id },
      data: hidden ? { hidden: true, hiddenReason: reason, hiddenAt: now } : { hidden: false, hiddenReason: "", hiddenAt: null },
    }),
    prisma.adminAuditLog.create({
      data: auditData(actor, hidden ? "offering.hide" : "offering.restore", "offering", id, reason),
    }),
  ]);
  return { ok: true as const, id, slug: offering.storefront.slug, userId: offering.storefront.userId };
}

export async function setReviewHiddenState(actor: AdminActor, id: string, hidden: boolean, reason: string) {
  const review = await prisma.review.findUnique({ where: { id }, select: { id: true, listingId: true } });
  if (!review) return { ok: false as const, code: "missing" as const };
  const now = new Date();
  await prisma.$transaction([
    prisma.review.update({
      where: { id },
      data: hidden ? { hidden: true, hiddenReason: reason, hiddenAt: now } : { hidden: false, hiddenReason: "", hiddenAt: null },
    }),
    prisma.adminAuditLog.create({
      data: auditData(actor, hidden ? "review.hide" : "review.restore", "review", id, reason),
    }),
  ]);
  return { ok: true as const, id, listingId: review.listingId };
}

export async function setUserSuspendedState(actor: AdminActor, userId: string, suspended: boolean, reason: string) {
  if (suspended && actor.id === userId) return { ok: false as const, code: "self" as const };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, storefront: { select: { slug: true } } },
  });
  if (!user) return { ok: false as const, code: "missing" as const };
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: suspended
        ? { suspended: true, suspendedReason: reason, suspendedAt: now }
        : { suspended: false, suspendedReason: "", suspendedAt: null },
    }),
    prisma.adminAuditLog.create({
      data: auditData(actor, suspended ? "user.suspend" : "user.unsuspend", "user", userId, reason),
    }),
  ]);
  return { ok: true as const, userId, slug: user.storefront?.slug ?? "" };
}

export async function setUserProState(actor: AdminActor, userId: string, grant: boolean, reason: string) {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, verifiedPro: true, verifiedProUntil: true, storefront: { select: { slug: true } } },
  });
  if (!before) return { ok: false as const, code: "missing" as const };
  const action = !grant ? "pro.remove" : isProActive(before) ? "pro.extend" : "pro.grant";
  await prisma.$transaction(async (tx) => {
    const updated = await setUserPro(tx, userId, grant);
    if (!updated) throw new Error("missing user");
    await tx.adminAuditLog.create({
      data: auditData(actor, action, "user", userId, reason),
    });
  });
  return { ok: true as const, userId, slug: before.storefront?.slug ?? "" };
}

export async function setShopDiasporaState(actor: AdminActor, storefrontId: string, servesDiaspora: boolean, reason: string) {
  const shop = await prisma.storefront.findUnique({
    where: { id: storefrontId },
    select: { id: true, slug: true, userId: true },
  });
  if (!shop) return { ok: false as const, code: "missing" as const };
  await prisma.$transaction([
    prisma.storefront.update({ where: { id: storefrontId }, data: { servesDiaspora } }),
    prisma.adminAuditLog.create({
      data: auditData(actor, servesDiaspora ? "shop.diaspora_on" : "shop.diaspora_off", "shop", storefrontId, reason),
    }),
  ]);
  return { ok: true as const, slug: shop.slug, userId: shop.userId };
}

export function auditData(actor: AdminActor, action: string, targetType: string, targetId: string, reason: string) {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    action,
    targetType,
    targetId,
    reason: reason.slice(0, REASON_MAX),
  };
}

export const AUDIT_LABELS: Record<string, string> = {
  "listing.hide": "Hid a listing",
  "listing.restore": "Restored a listing",
  "listing.verify": "Granted listing verified",
  "listing.unverify": "Removed listing verified",
  "listing.feature": "Featured a listing",
  "listing.unfeature": "Removed featured",
  "listing.reframe": "Reframed a listing photo",
  "shop.hide": "Took down a shop",
  "shop.restore": "Restored a shop",
  "shop.diaspora_on": "Turned on diaspora orders",
  "shop.diaspora_off": "Turned off diaspora orders",
  "offering.hide": "Hid an offering",
  "offering.restore": "Restored an offering",
  "review.hide": "Hid a review",
  "review.restore": "Restored a review",
  "user.suspend": "Suspended an account",
  "user.unsuspend": "Unsuspended an account",
  "pro.grant": "Granted Pro plan",
  "pro.extend": "Added Pro days",
  "pro.remove": "Removed Pro plan",
  "report.dismiss": "Dismissed a report",
  "report.action": "Actioned a report",
  "badge.grant": "Granted a shop check",
  "badge.remove": "Removed a shop check",
  "phones.normalise": "Normalised phone numbers",
  "listing.contact": "Edited listing contact numbers",
  "user.contact": "Edited account contact numbers",
  "order.subaccount": "Saved a Paystack subaccount",
  "order.delivery": "Saved a delivery price",
  "order.refund": "Refunded a protected order",
  "shop.send_home_on": "Turned on a send-home pilot",
  "shop.send_home_off": "Turned off a send-home pilot",
  "diaspora_waitlist.export": "Exported the send-home waitlist",
  "business_lead.update": "Updated a business sign-up",
  "business_lead.export": "Exported business sign-ups",
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}
