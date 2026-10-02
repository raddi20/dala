import {
  CAPTION_MAX,
  DURATION_LIMIT_SECONDS,
  IN_FLIGHT_STATUSES,
  MAX_UPLOAD_BYTES,
  REJECT_PURGE_MS,
  REJECT_REASON_MAX,
  UPLOADS_PER_DAY,
  isAcceptedVideoFile,
} from "@/lib/video/constants";

export type VideoStatus = "uploading" | "processing" | "pending" | "approved" | "rejected" | "errored" | "replaced";

export type VideoRow = {
  id: string;
  storefrontId: string;
  status: string;
  uploadId: string;
  assetId: string;
  playbackId: string;
  publicPlaybackId: string;
  durationSeconds: number | null;
  muxDeletedAt: Date | null;
};

export type VideoFailure = { ok: false; code: string; error: string };

export function shopVideoIsPublic(input: {
  verifiedPro: boolean;
  published: boolean;
  status: string;
  publicPlaybackId: string;
}) {
  return Boolean(
    input.verifiedPro &&
      input.published &&
      input.status === "approved" &&
      input.publicPlaybackId.trim(),
  );
}

/** Hidden while Pro is off. The asset stays, so renewing Pro shows it again. */
export function shopVideoHiddenByPro(input: { verifiedPro: boolean; status: string; publicPlaybackId: string }) {
  return Boolean(!input.verifiedPro && input.status === "approved" && input.publicPlaybackId.trim());
}

export function planUpload(input: {
  verifiedPro: boolean;
  consent: boolean;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  caption: string;
  recentUploads: number;
  inFlight: boolean;
  adminExempt: boolean;
}): { ok: true; caption: string } | VideoFailure {
  if (!input.verifiedPro) {
    return { ok: false, code: "pro", error: "Shop video is part of the Pro plan." };
  }
  if (!input.consent) {
    return { ok: false, code: "consent", error: "Tick the box to confirm you have the rights and consent." };
  }
  if (!isAcceptedVideoFile(input.fileName, input.mimeType)) {
    return { ok: false, code: "type", error: "Use an MP4 or MOV file. iPhone video is fine." };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, code: "size", error: "That file looks empty." };
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "size", error: "That video is over 200 MB. Trim it and try again." };
  }
  if (input.durationSeconds !== null && (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0)) {
    return { ok: false, code: "duration", error: "Could not read the length of that video." };
  }
  if (input.durationSeconds !== null && input.durationSeconds > DURATION_LIMIT_SECONDS) {
    return { ok: false, code: "duration", error: "Shop videos can be up to 45 seconds." };
  }
  const caption = input.caption.replace(/\s+/g, " ").trim();
  if (caption.length > CAPTION_MAX) {
    return { ok: false, code: "invalid", error: `The caption can be ${CAPTION_MAX} characters.` };
  }
  if (input.inFlight) {
    return { ok: false, code: "inflight", error: "A video is already uploading or waiting for review." };
  }
  if (!input.adminExempt && input.recentUploads >= UPLOADS_PER_DAY) {
    return { ok: false, code: "rate", error: "This shop can upload one video a day. Try again tomorrow." };
  }
  return { ok: true, caption };
}

export function inFlightStatus(status: string) {
  return (IN_FLIGHT_STATUSES as readonly string[]).includes(status);
}

export function planReviewDecision(input: {
  role: string;
  status: string;
  action: "approve" | "reject" | "remove";
  reason: string;
}): { ok: true; reason: string } | VideoFailure {
  if (input.role !== "admin") return { ok: false, code: "forbidden", error: "Only an admin can do that." };
  const reason = input.reason.replace(/\s+/g, " ").trim();
  if (input.action === "approve") {
    if (input.status !== "pending") return { ok: false, code: "invalid", error: "Only a video waiting for review can be approved." };
    return { ok: true, reason };
  }
  if (reason.length < 3) return { ok: false, code: "invalid", error: "Write a short reason." };
  if (reason.length > REJECT_REASON_MAX) {
    return { ok: false, code: "invalid", error: `The reason can be ${REJECT_REASON_MAX} characters.` };
  }
  if (input.action === "reject" && input.status !== "pending") {
    return { ok: false, code: "invalid", error: "Only a video waiting for review can be rejected." };
  }
  if (input.action === "remove" && input.status !== "approved") {
    return { ok: false, code: "invalid", error: "Only the live video can be removed." };
  }
  return { ok: true, reason };
}

export function purgeDeadline(now: Date) {
  return new Date(now.getTime() + REJECT_PURGE_MS);
}

export type ReadyDecision =
  | { action: "ignore" }
  | { action: "pending"; durationSeconds: number | null; playbackId: string }
  | { action: "too_long"; durationSeconds: number; playbackId: string };

const TERMINAL = new Set(["pending", "approved", "rejected", "replaced"]);

export function decideReady(video: { status: string }, input: { durationSeconds: number | null; playbackId: string }): ReadyDecision {
  if (TERMINAL.has(video.status)) return { action: "ignore" };
  if (input.durationSeconds !== null && input.durationSeconds > DURATION_LIMIT_SECONDS) {
    return { action: "too_long", durationSeconds: input.durationSeconds, playbackId: input.playbackId };
  }
  return { action: "pending", durationSeconds: input.durationSeconds, playbackId: input.playbackId };
}

export type MuxEventKind =
  | { kind: "asset_created"; uploadId: string; assetId: string }
  | { kind: "asset_ready"; uploadId: string; assetId: string; durationSeconds: number | null; playbackId: string }
  | { kind: "asset_errored"; uploadId: string; assetId: string; message: string }
  | { kind: "upload_failed"; uploadId: string; message: string }
  | {
      kind: "moderation";
      assetId: string;
      videoId: string;
      status: "clear" | "flagged" | "errored";
      detail: string;
    }
  | { kind: "ignore" };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function signedPlaybackId(data: Record<string, unknown>) {
  const ids = Array.isArray(data.playback_ids) ? data.playback_ids : [];
  const rows = ids.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item));
  const signed = rows.find((item) => item.policy === "signed") ?? rows[0];
  return signed ? text(signed.id) : "";
}

function moderationDetail(data: Record<string, unknown>, status: "clear" | "flagged" | "errored") {
  if (status === "errored") {
    const errors = Array.isArray(data.errors) ? data.errors : [];
    const first = asRecord(errors[0]);
    return text(first?.message) || "The automatic check could not finish. A person still reviews the video.";
  }
  const outputs = asRecord(data.outputs);
  const scores = asRecord(outputs?.max_scores);
  const sexual = numberOrNull(scores?.sexual);
  const violence = numberOrNull(scores?.violence);
  const scoreText =
    sexual === null && violence === null
      ? ""
      : ` Highest scores: sexual ${sexual ?? "—"}, violence ${violence ?? "—"}.`;
  if (status === "flagged") {
    return `The automatic check flagged this video.${scoreText} This is advice only. A person still decides.`;
  }
  return `The automatic check did not flag this video.${scoreText} This is advice only. A person still decides.`;
}

export function parseMuxEvent(type: string, data: unknown): MuxEventKind {
  const record = asRecord(data) ?? {};
  if (type === "video.upload.asset_created") {
    const uploadId = text(record.id);
    const assetId = text(record.asset_id);
    if (!uploadId || !assetId) return { kind: "ignore" };
    return { kind: "asset_created", uploadId, assetId };
  }
  if (type === "video.asset.ready") {
    return {
      kind: "asset_ready",
      uploadId: text(record.upload_id),
      assetId: text(record.id),
      durationSeconds: numberOrNull(record.duration),
      playbackId: signedPlaybackId(record),
    };
  }
  if (type === "video.asset.errored") {
    const errors = Array.isArray(record.errors) ? record.errors : [];
    const first = asRecord(errors[0]);
    return {
      kind: "asset_errored",
      uploadId: text(record.upload_id),
      assetId: text(record.id),
      message: text(first?.message) || text(asRecord(record.error)?.message) || "Mux could not prepare this video.",
    };
  }
  if (type === "video.upload.errored" || type === "video.upload.cancelled" || type === "video.upload.timed_out") {
    return {
      kind: "upload_failed",
      uploadId: text(record.id),
      message: text(asRecord(record.error)?.message) || "The upload did not finish.",
    };
  }
  if (type.startsWith("robots.job.moderate.")) {
    const outputs = asRecord(record.outputs);
    const exceeded = outputs?.exceeds_threshold === true;
    const phase = type.endsWith(".errored") ? "errored" : type.endsWith(".completed") ? (exceeded ? "flagged" : "clear") : null;
    if (!phase) return { kind: "ignore" };
    return {
      kind: "moderation",
      assetId: text(asRecord(record.parameters)?.asset_id) || text(record.asset_id),
      videoId: text(record.passthrough),
      status: phase,
      detail: moderationDetail(record, phase),
    };
  }
  return { kind: "ignore" };
}

export function publicPosterUrl(playbackId: string) {
  if (!playbackId) return "";
  const params = new URLSearchParams({
    time: "1",
    width: "1280",
    height: "720",
    fit_mode: "smartcrop",
  });
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?${params.toString()}`;
}

export function signedPosterUrl(playbackId: string, token: string) {
  if (!playbackId || !token) return "";
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?token=${encodeURIComponent(token)}`;
}
