import { Prisma, PrismaClient } from "@prisma/client";
import type { VideoBackend } from "@/lib/video/backend";
import { aiModerationEnabled, playbackReferrerDomains, videoMode } from "@/lib/video/config";
import {
  IN_FLIGHT_STATUSES,
  LIVE_CHUNK_SIZE_KB,
  MOCK_CHUNK_SIZE_KB,
  UPLOAD_WINDOW_MS,
  VIDEO_CONSENT_VERSION,
} from "@/lib/video/constants";
import {
  decideReady,
  parseMuxEvent,
  planReviewDecision,
  planUpload,
  publicPosterUrl,
  purgeDeadline,
  shopVideoHiddenByPro,
  shopVideoIsPublic,
  type VideoFailure,
} from "@/lib/video/machine";

const MOCK_POSTER = "/mock/shop-poster.jpg";

type Db = PrismaClient;

export type UploadActor = {
  id: string;
  role: string;
  verifiedPro: boolean;
};

function uniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function audit(
  db: Db | Prisma.TransactionClient,
  input: {
    storefrontId: string;
    videoId: string;
    action: string;
    note: string;
    adminId?: string;
    adminEmail?: string;
    adminName?: string;
    createdAt?: Date;
  },
) {
  await db.shopVideoEvent.create({
    data: {
      storefrontId: input.storefrontId,
      videoId: input.videoId,
      action: input.action,
      note: input.note,
      adminId: input.adminId ?? "",
      adminEmail: input.adminEmail ?? "",
      adminName: input.adminName ?? "",
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

export async function createShopVideoUpload(
  db: Db,
  backend: VideoBackend,
  input: {
    actor: UploadActor;
    storefrontId: string;
    corsOrigin: string;
    consent: boolean;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number | null;
    caption: string;
    now?: Date;
  },
): Promise<{ ok: true; videoId: string; uploadUrl: string; chunkSizeKb: number } | VideoFailure> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - UPLOAD_WINDOW_MS);
  const prepared = await db.$transaction(async (tx) => {
    const inflight = await tx.shopVideo.findFirst({
      where: { storefrontId: input.storefrontId, status: { in: [...IN_FLIGHT_STATUSES] } },
      select: { id: true },
    });
    const recentUploads = await tx.shopVideo.count({
      where: { storefrontId: input.storefrontId, createdAt: { gte: since }, NOT: { uploadId: "" } },
    });
    const plan = planUpload({
      verifiedPro: input.actor.verifiedPro,
      consent: input.consent,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      durationSeconds: input.durationSeconds,
      caption: input.caption,
      recentUploads,
      inFlight: Boolean(inflight),
      adminExempt: input.actor.role === "admin",
    });
    if (!plan.ok) return plan;
    const video = await tx.shopVideo.create({
      data: {
        storefrontId: input.storefrontId,
        status: "uploading",
        sizeBytes: Math.round(input.sizeBytes),
        durationSeconds: input.durationSeconds,
        caption: plan.caption,
        consentAt: now,
        consentVersion: VIDEO_CONSENT_VERSION,
      },
    });
    await audit(tx, {
      storefrontId: input.storefrontId,
      videoId: video.id,
      action: "upload",
      note: plan.caption ? `Seller uploaded a video. ${plan.caption}` : "Seller uploaded a video.",
      createdAt: now,
    });
    return { ok: true as const, videoId: video.id, caption: plan.caption };
  });
  if (!prepared.ok) return prepared;

  try {
    const upload = await backend.createDirectUpload({
      corsOrigin: input.corsOrigin,
      passthrough: prepared.videoId,
    });
    await db.shopVideo.update({
      where: { id: prepared.videoId },
      data: { uploadId: upload.uploadId },
    });
    return {
      ok: true,
      videoId: prepared.videoId,
      uploadUrl: upload.url,
      chunkSizeKb: backend.kind === "mock" ? MOCK_CHUNK_SIZE_KB : LIVE_CHUNK_SIZE_KB,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the upload.";
    await db.shopVideo.update({
      where: { id: prepared.videoId },
      data: { status: "errored", rejectReason: "Could not start the upload. Nothing was sent." },
    });
    await audit(db, {
      storefrontId: input.storefrontId,
      videoId: prepared.videoId,
      action: "error",
      note: message,
    });
    return { ok: false, code: "unavailable", error: "Could not start the upload. Try again in a minute." };
  }
}

async function findVideo(db: Db | Prisma.TransactionClient, input: { uploadId?: string; assetId?: string; videoId?: string }) {
  if (input.videoId) return db.shopVideo.findUnique({ where: { id: input.videoId } });
  if (input.uploadId) return db.shopVideo.findFirst({ where: { uploadId: input.uploadId } });
  if (input.assetId) return db.shopVideo.findFirst({ where: { assetId: input.assetId }, orderBy: { createdAt: "desc" } });
  return null;
}

export async function handleMuxEvent(
  db: Db,
  backend: VideoBackend,
  input: { eventId: string; type: string; data: unknown; now?: Date },
): Promise<{ ok: true; duplicate: boolean } | VideoFailure> {
  const eventId = input.eventId.trim();
  if (!eventId) return { ok: false, code: "invalid", error: "Webhook event has no id." };
  const now = input.now ?? new Date();
  const parsed = parseMuxEvent(input.type, input.data);
  let deleteAssetId = "";

  try {
    await db.$transaction(async (tx) => {
      await tx.muxEventReceipt.create({ data: { id: eventId, type: input.type } });
      if (parsed.kind === "ignore") return;

      if (parsed.kind === "moderation") {
        const video =
          (parsed.videoId ? await findVideo(tx, { videoId: parsed.videoId }) : null) ??
          (await findVideo(tx, { assetId: parsed.assetId }));
        if (!video) return;
        await tx.shopVideo.update({
          where: { id: video.id },
          data: { aiStatus: parsed.status, aiDetail: parsed.detail },
        });
        return;
      }

      const video =
        parsed.kind === "asset_created" || parsed.kind === "upload_failed"
          ? await findVideo(tx, { uploadId: parsed.uploadId })
          : (await findVideo(tx, { uploadId: parsed.uploadId })) ?? (await findVideo(tx, { assetId: parsed.assetId }));
      if (!video) return;

      if (parsed.kind === "asset_created") {
        if (video.status === "uploading" || (video.status === "processing" && !video.assetId)) {
          await tx.shopVideo.update({
            where: { id: video.id },
            data: { assetId: parsed.assetId, status: "processing" },
          });
        }
        return;
      }

      if (parsed.kind === "upload_failed" || parsed.kind === "asset_errored") {
        if (video.status === "approved" || video.status === "rejected" || video.status === "replaced") return;
        await tx.shopVideo.update({
          where: { id: video.id },
          data: { status: "errored", rejectReason: parsed.message, ...(parsed.kind === "asset_errored" && parsed.assetId ? { assetId: parsed.assetId } : {}) },
        });
        await audit(tx, {
          storefrontId: video.storefrontId,
          videoId: video.id,
          action: "error",
          note: parsed.message,
          createdAt: now,
        });
        return;
      }

      const decision = decideReady(video, {
        durationSeconds: parsed.durationSeconds,
        playbackId: parsed.playbackId,
      });
      if (decision.action === "ignore") return;
      const poster = backend.kind === "mock" ? MOCK_POSTER : "";
      if (decision.action === "too_long") {
        await tx.shopVideo.update({
          where: { id: video.id },
          data: {
            status: "rejected",
            assetId: parsed.assetId || video.assetId,
            playbackId: decision.playbackId,
            durationSeconds: decision.durationSeconds,
            rejectReason: "This video is longer than 45 seconds.",
            rejectedAt: now,
            purgeAfter: now,
            posterUrl: poster,
          },
        });
        await audit(tx, {
          storefrontId: video.storefrontId,
          videoId: video.id,
          action: "reject",
          note: "Rejected automatically: longer than 45 seconds.",
          createdAt: now,
        });
        deleteAssetId = parsed.assetId || video.assetId;
        return;
      }
      await tx.shopVideo.update({
        where: { id: video.id },
        data: {
          status: "pending",
          assetId: parsed.assetId || video.assetId,
          playbackId: decision.playbackId,
          durationSeconds: decision.durationSeconds,
          posterUrl: poster,
          aiStatus: aiModerationEnabled() && backend.kind === "mock" ? "clear" : video.aiStatus,
          aiDetail:
            aiModerationEnabled() && backend.kind === "mock"
              ? "Mock check. Nothing was flagged. This is advice only. A person still decides."
              : video.aiDetail,
        },
      });
    });
  } catch (error) {
    if (uniqueConflict(error)) return { ok: true, duplicate: true };
    throw error;
  }

  if (deleteAssetId) {
    try {
      await backend.deleteAsset(deleteAssetId);
      await db.shopVideo.updateMany({
        where: { assetId: deleteAssetId, muxDeletedAt: null },
        data: { muxDeletedAt: now },
      });
    } catch (error) {
      console.error("Could not delete an over-length Mux asset", deleteAssetId, error);
    }
  }

  if (parsed.kind === "asset_ready" && aiModerationEnabled() && backend.kind === "live") {
    const video = await findVideo(db, { assetId: parsed.assetId });
    if (video?.status === "pending" && video.assetId) {
      try {
        await backend.requestModeration({ assetId: video.assetId, videoId: video.id });
        await db.shopVideo.update({ where: { id: video.id }, data: { aiStatus: "pending", aiDetail: "Automatic check is running. It does not approve or reject." } });
      } catch (error) {
        console.error("Mux moderation request failed", error);
        await db.shopVideo.update({
          where: { id: video.id },
          data: { aiStatus: "unavailable", aiDetail: "The automatic check did not run. A person still reviews the video." },
        });
      }
    }
  }

  return { ok: true, duplicate: false };
}

export async function approveShopVideo(
  db: Db,
  backend: VideoBackend,
  input: { role: string; videoId: string; admin: { id: string; email: string; name: string }; now?: Date },
): Promise<{ ok: true; slug: string } | VideoFailure> {
  const now = input.now ?? new Date();
  const video = await db.shopVideo.findUnique({ where: { id: input.videoId } });
  if (!video) return { ok: false, code: "missing", error: "That video was not found." };
  const plan = planReviewDecision({ role: input.role, status: video.status, action: "approve", reason: "" });
  if (!plan.ok) return plan;
  if (!video.assetId) return { ok: false, code: "invalid", error: "This video is not ready to approve yet." };

  let publicPlaybackId = "";
  try {
    const restrictionId = await backend.ensurePlaybackRestriction(playbackReferrerDomains());
    publicPlaybackId = await backend.addPublicPlayback({ assetId: video.assetId, restrictionId });
  } catch (error) {
    console.error("Could not publish the video", error);
    return { ok: false, code: "unavailable", error: "Could not make the video public. It is still waiting for review." };
  }

  const posterUrl = backend.kind === "mock" ? MOCK_POSTER : publicPosterUrl(publicPlaybackId);
  const previous = await db.$transaction(async (tx) => {
    const current = await tx.shopVideo.findFirst({
      where: { storefrontId: video.storefrontId, status: "approved", NOT: { id: video.id } },
    });
    await tx.shopVideo.update({
      where: { id: video.id },
      data: { status: "approved", publicPlaybackId, posterUrl },
    });
    await audit(tx, {
      storefrontId: video.storefrontId,
      videoId: video.id,
      action: "approve",
      note: "Approved. The video is on the shop.",
      adminId: input.admin.id,
      adminEmail: input.admin.email,
      adminName: input.admin.name,
      createdAt: now,
    });
    if (current) {
      await tx.shopVideo.update({ where: { id: current.id }, data: { status: "replaced", publicPlaybackId: "" } });
      await audit(tx, {
        storefrontId: video.storefrontId,
        videoId: current.id,
        action: "replace",
        note: "Replaced by a newer approved video.",
        adminId: input.admin.id,
        adminEmail: input.admin.email,
        adminName: input.admin.name,
        createdAt: now,
      });
    }
    return current;
  });

  if (previous?.assetId && !previous.muxDeletedAt) {
    try {
      await backend.deleteAsset(previous.assetId);
      await db.shopVideo.update({ where: { id: previous.id }, data: { muxDeletedAt: now } });
    } catch (error) {
      console.error("Could not delete the replaced Mux asset", previous.assetId, error);
    }
  }

  const shop = await db.storefront.findUnique({ where: { id: video.storefrontId }, select: { slug: true } });
  return { ok: true, slug: shop?.slug ?? "" };
}

export async function rejectShopVideo(
  db: Db,
  input: {
    role: string;
    videoId: string;
    reason: string;
    admin: { id: string; email: string; name: string };
    now?: Date;
  },
): Promise<{ ok: true; slug: string } | VideoFailure> {
  const now = input.now ?? new Date();
  const video = await db.shopVideo.findUnique({ where: { id: input.videoId } });
  if (!video) return { ok: false, code: "missing", error: "That video was not found." };
  const plan = planReviewDecision({ role: input.role, status: video.status, action: "reject", reason: input.reason });
  if (!plan.ok) return plan;
  await db.$transaction(async (tx) => {
    await tx.shopVideo.update({
      where: { id: video.id },
      data: {
        status: "rejected",
        rejectReason: plan.reason,
        rejectedAt: now,
        purgeAfter: purgeDeadline(now),
        publicPlaybackId: "",
      },
    });
    await audit(tx, {
      storefrontId: video.storefrontId,
      videoId: video.id,
      action: "reject",
      note: plan.reason,
      adminId: input.admin.id,
      adminEmail: input.admin.email,
      adminName: input.admin.name,
      createdAt: now,
    });
  });
  const shop = await db.storefront.findUnique({ where: { id: video.storefrontId }, select: { slug: true } });
  return { ok: true, slug: shop?.slug ?? "" };
}

/** Hides a live video immediately and deletes the Mux asset now. The audit row stays. */
export async function removeLiveShopVideo(
  db: Db,
  backend: VideoBackend,
  input: {
    role: string;
    videoId: string;
    reason: string;
    admin: { id: string; email: string; name: string };
    now?: Date;
  },
): Promise<{ ok: true; slug: string } | VideoFailure> {
  const now = input.now ?? new Date();
  const video = await db.shopVideo.findUnique({ where: { id: input.videoId } });
  if (!video) return { ok: false, code: "missing", error: "That video was not found." };
  const plan = planReviewDecision({ role: input.role, status: video.status, action: "remove", reason: input.reason });
  if (!plan.ok) return plan;
  await db.$transaction(async (tx) => {
    await tx.shopVideo.update({
      where: { id: video.id },
      data: {
        status: "rejected",
        rejectReason: plan.reason,
        rejectedAt: now,
        publicPlaybackId: "",
        purgeAfter: now,
      },
    });
    await audit(tx, {
      storefrontId: video.storefrontId,
      videoId: video.id,
      action: "remove",
      note: plan.reason,
      adminId: input.admin.id,
      adminEmail: input.admin.email,
      adminName: input.admin.name,
      createdAt: now,
    });
  });
  if (video.assetId && !video.muxDeletedAt) {
    try {
      await backend.deleteAsset(video.assetId);
      await db.shopVideo.update({ where: { id: video.id }, data: { muxDeletedAt: now } });
    } catch (error) {
      console.error("Could not delete a removed Mux asset", video.assetId, error);
    }
  }
  const shop = await db.storefront.findUnique({ where: { id: video.storefrontId }, select: { slug: true } });
  return { ok: true, slug: shop?.slug ?? "" };
}

export async function purgeExpiredVideos(db: Db, backend: VideoBackend, now = new Date()) {
  const due = await db.shopVideo.findMany({
    where: {
      status: "rejected",
      muxDeletedAt: null,
      purgeAfter: { lte: now },
      NOT: { assetId: "" },
    },
    take: 20,
    orderBy: { purgeAfter: "asc" },
  });
  for (const video of due) {
    try {
      await backend.deleteAsset(video.assetId);
      await db.shopVideo.update({ where: { id: video.id }, data: { muxDeletedAt: now } });
    } catch (error) {
      console.error("Could not delete a rejected Mux asset", video.id, error);
    }
  }
  return due.length;
}

export async function completeMockUpload(db: Db, backend: VideoBackend, uploadId: string) {
  if (videoMode() !== "mock") return { ok: false as const, error: "Mock uploads are off." };
  const video = await db.shopVideo.findFirst({ where: { uploadId } });
  if (!video) return { ok: false as const, error: "That upload was not found." };
  const assetId = video.assetId || `mockasset_${uploadId}`;
  await handleMuxEvent(db, backend, {
    eventId: `mock-created-${uploadId}`,
    type: "video.upload.asset_created",
    data: { id: uploadId, asset_id: assetId },
  });
  await handleMuxEvent(db, backend, {
    eventId: `mock-ready-${uploadId}`,
    type: "video.asset.ready",
    data: {
      id: assetId,
      upload_id: uploadId,
      duration: video.durationSeconds,
      playback_ids: [{ id: `mockplay_${uploadId}`, policy: "signed" }],
    },
  });
  return { ok: true as const };
}

export function chunkSizeForMode() {
  return videoMode() === "mock" ? MOCK_CHUNK_SIZE_KB : LIVE_CHUNK_SIZE_KB;
}

export { shopVideoHiddenByPro, shopVideoIsPublic };
