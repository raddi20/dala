/**
 * Shop video rules.
 *
 * Pro lapse: an approved video is hidden from the shop, from cards, and from link
 * previews as soon as Verified Pro is off. The Mux asset and this row are kept.
 * Turning Pro back on shows the same video again, with no new upload and no new review.
 * Pro in this app is a flag, not a dated subscription, so nothing is deleted on lapse.
 *
 * Rejection: a video that never went live is deleted from Mux 14 days after rejection.
 * The row, the reason, and the poster stay. A clip longer than 45 seconds is deleted
 * from Mux immediately. An admin takedown of a live video hides it immediately and
 * deletes the Mux asset immediately. The audit row stays in every case.
 *
 * Playback: pending videos use a signed playback id only. Approval adds a public
 * playback id that carries a Mux referrer restriction (this site, its www/apex host,
 * and localhost). The public shop page does not use a signed token. See config.ts.
 */

export const VIDEO_CONSENT_VERSION = "2026-10-01";

export const MAX_DURATION_SECONDS = 45;
/** Mux reports a float. A clip the phone measured as 45.0 can come back slightly over. */
export const DURATION_LIMIT_SECONDS = 45.5;

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Shown on the play button. A low-quality start of a 45s clip is about this much. */
export const PLAY_DATA_LABEL = "~5 MB";

export const UPLOADS_PER_DAY = 1;
export const UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1000;

export const REJECT_PURGE_DAYS = 14;
export const REJECT_PURGE_MS = REJECT_PURGE_DAYS * 24 * 60 * 60 * 1000;

export const REVIEW_TOKEN_TTL = "10m";

/** Mux's recommended direct-upload chunk size, in KiB. Must be a multiple of 256. */
export const LIVE_CHUNK_SIZE_KB = 5120;
/** Smaller chunks in mock mode so a short local file still shows progress. */
export const MOCK_CHUNK_SIZE_KB = 256;

export const IN_FLIGHT_STATUSES = ["uploading", "processing", "pending"] as const;

export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v"] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/hevc",
  "video/h265",
  "video/x-m4v",
] as const;

export const CAPTION_MAX = 180;
export const REJECT_REASON_MAX = 500;

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot).toLowerCase();
}

export function isAcceptedVideoFile(fileName: string, mimeType: string) {
  const extension = extensionOf(fileName);
  const extensionOk = (VIDEO_EXTENSIONS as readonly string[]).includes(extension);
  const mime = mimeType.trim().toLowerCase();
  const mimeOk = mime === "" || (VIDEO_MIME_TYPES as readonly string[]).includes(mime);
  return extensionOk && mimeOk;
}
