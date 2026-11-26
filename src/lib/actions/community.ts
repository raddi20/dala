"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDemoEmail } from "@/lib/admin-access";
import { isAllowedListingPhotoUrl } from "@/lib/ai/resize-photo";
import { applyFollow, FOLLOW_LIMIT, FOLLOW_WINDOW_MS } from "@/lib/community/follow";
import { prismaFollowStore } from "@/lib/community/follow-db";
import { updateExpiresAt } from "@/lib/community/expiry";
import { judgeShopUpdate } from "@/lib/community/judge";
import { updatesAllowed } from "@/lib/community/plan";
import { deleteUpdatePhoto } from "@/lib/community/photos";
import {
  checkUpdateText,
  UPDATE_PAUSED,
  UPDATE_POST_LIMIT,
  UPDATE_POST_LIMIT_MESSAGE,
  UPDATE_POST_WINDOW_MS,
} from "@/lib/community/text-guard";
import { reasonOrDefault, requiredReason, writeAdminAudit } from "@/lib/moderation";
import { isProActive } from "@/lib/pro";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindow } from "@/lib/rate-limit";
import { getSessionUser, requireAdmin } from "@/lib/session";
import { safePath } from "@/lib/utils";
import { field, type ActionState } from "@/lib/validators";

const SETTINGS_ID = "default";

function refreshShop(slug: string) {
  revalidatePath(`/b/${slug}`);
  revalidatePath("/account");
  revalidatePath("/saved");
  revalidatePath("/shops");
  revalidatePath("/");
}

export async function readUpdatePause(): Promise<{ paused: boolean; note: string }> {
  const row = await prisma.communitySetting.findUnique({ where: { id: SETTINGS_ID } });
  return { paused: row?.updatesPaused ?? false, note: row?.pauseNote ?? "" };
}

export async function toggleShopFollow(formData: FormData) {
  const returnTo = safePath(field(formData, "returnTo"), "/");
  const shopId = field(formData, "shopId").trim();
  const user = await getSessionUser();
  if (!user) {
    const apply = `/api/community/follow?shop=${encodeURIComponent(shopId)}&next=${encodeURIComponent(returnTo)}`;
    redirect(`/login?next=${encodeURIComponent(apply)}`);
  }
  const gate = await consumeFixedWindow({
    action: "shop-follow",
    subject: user.id,
    limit: FOLLOW_LIMIT,
    windowMs: FOLLOW_WINDOW_MS,
  });
  const result = await applyFollow(prismaFollowStore(), {
    userId: user.id,
    userEmail: user.email,
    shopId,
    limited: gate.limited,
    intent: "toggle",
  });
  const shop = await prisma.storefront.findUnique({ where: { id: shopId }, select: { slug: true } });
  if (shop) refreshShop(shop.slug);
  if (!result.ok) {
    const join = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${join}follow=${result.code}`);
  }
  redirect(returnTo);
}

export async function postShopUpdate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to post an update." };
  const shop = await prisma.storefront.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      slug: true,
      published: true,
      hidden: true,
      user: { select: { email: true, suspended: true, verifiedPro: true, verifiedProUntil: true } },
    },
  });
  if (!shop) return { error: "Open a shop before you post an update." };
  if (isDemoEmail(shop.user.email)) return { error: "Sample shops don't post updates." };
  if (!shop.published || shop.hidden || shop.user.suspended) {
    return { error: "Publish the shop before you post an update." };
  }
  const pause = await readUpdatePause();
  if (pause.paused) return { error: UPDATE_PAUSED };
  const checked = checkUpdateText(field(formData, "body"));
  if (!checked.ok) return { error: checked.error };
  const photoUrl = field(formData, "photoUrl").trim();
  if (photoUrl && !isAllowedListingPhotoUrl(photoUrl)) {
    return { error: "Upload the photo from this phone so it stays with the shop." };
  }
  const recent = await prisma.shopUpdate.findMany({
    where: { storefrontId: shop.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const allowance = updatesAllowed({
    pro: isProActive(shop.user),
    now: new Date(),
    postedAt: recent.map((row) => row.createdAt),
  });
  if (!allowance.ok) return { error: allowance.message };
  const gate = await consumeFixedWindow({
    action: "shop-update",
    subject: user.id,
    limit: UPDATE_POST_LIMIT,
    windowMs: UPDATE_POST_WINDOW_MS,
  });
  if (gate.limited) return { error: UPDATE_POST_LIMIT_MESSAGE };

  const judged = await judgeShopUpdate({ body: checked.body, photoUrl, authorId: user.id });
  const now = new Date();
  const created = await prisma.shopUpdate.create({
    data: {
      storefrontId: shop.id,
      authorId: user.id,
      body: checked.body,
      photoUrl,
      status: judged.status,
      holdReason: judged.reason,
      expiresAt: updateExpiresAt(now),
    },
  });
  if (judged.flags.length > 0) {
    await prisma.moderationFlag.createMany({
      data: judged.flags.map((flag) => ({
        targetType: "shop_update",
        targetId: created.id,
        source: "ai",
        kind: flag.kind.slice(0, 40),
        severity: flag.severity,
        reason: flag.reason.slice(0, 200),
        evidenceJson: "{}",
        status: "open",
      })),
    });
  }
  refreshShop(shop.slug);
  revalidatePath("/admin/updates");
  return {
    error: "",
    ok: true,
    message:
      judged.status === "pending"
        ? "Saved. A moderator will look at it before it shows on the shop."
        : "Posted. It shows on your shop for 60 days.",
  };
}

export async function reviewShopUpdate(formData: FormData) {
  const admin = await requireAdmin("/admin/updates");
  const id = field(formData, "id");
  const decision = field(formData, "decision");
  const reason = requiredReason(field(formData, "reason"));
  if (!reason) redirect("/admin/updates?notice=reason");
  if (decision !== "approve" && decision !== "reject" && decision !== "remove") {
    redirect("/admin/updates?notice=missing");
  }
  const row = await prisma.shopUpdate.findUnique({
    where: { id },
    select: { id: true, photoUrl: true, storefront: { select: { slug: true } } },
  });
  if (!row) redirect("/admin/updates?notice=missing");
  const now = new Date();
  if (decision === "approve") {
    await prisma.shopUpdate.update({ where: { id }, data: { status: "approved", holdReason: "" } });
  } else if (decision === "reject") {
    await prisma.shopUpdate.update({ where: { id }, data: { status: "rejected", holdReason: reason } });
  } else {
    await prisma.shopUpdate.update({ where: { id }, data: { status: "removed", holdReason: reason } });
    if (row.photoUrl) await deleteUpdatePhoto(row.photoUrl);
  }
  await prisma.moderationFlag.updateMany({
    where: { targetType: "shop_update", targetId: id, status: "open" },
    data: { status: decision === "approve" ? "dismissed" : "actioned", resolvedAt: now },
  });
  await writeAdminAudit({
    actor: { id: admin.id, email: admin.email, name: admin.name },
    action: `update.${decision}`,
    targetType: "shop_update",
    targetId: id,
    reason,
  });
  refreshShop(row.storefront.slug);
  revalidatePath("/admin/updates");
  redirect("/admin/updates");
}

export async function setUpdatesPaused(formData: FormData) {
  const admin = await requireAdmin("/admin/updates");
  const reason = requiredReason(field(formData, "reason"));
  if (!reason) redirect("/admin/updates?notice=reason");
  const paused = field(formData, "paused") === "1";
  const note = field(formData, "note").trim().replace(/\s+/g, " ").slice(0, 200);
  await prisma.communitySetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, updatesPaused: paused, pauseNote: note },
    update: { updatesPaused: paused, pauseNote: note },
  });
  await writeAdminAudit({
    actor: { id: admin.id, email: admin.email, name: admin.name },
    action: paused ? "community.pause" : "community.unpause",
    targetType: "community",
    targetId: SETTINGS_ID,
    reason: reasonOrDefault(reason, paused ? "Pause shop updates" : "Allow shop updates"),
  });
  revalidatePath("/account");
  revalidatePath("/admin/updates");
  redirect("/admin/updates");
}
