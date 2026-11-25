import { IN_FLIGHT_STATUSES } from "@/lib/video/constants";
import type { VideoMode } from "@/lib/video/config";

/**
 * Weekly seller emails can carry one fixed shop-video tip. The copy is written here,
 * never by the AI, so what goes out is exactly the approved text.
 *
 * Shop video is one clip per shop and a Verified Pro perk (see lib/video/machine.ts).
 * - "upload": Pro is on and the shop has no video yet, so the seller can add one today.
 * - "pro": the shop is on the free plan. Only used while checkout is live, because the
 *   copy points to the Pro plan and a free shop cannot upload without it.
 * - null: no tip. The shop already has a live or in-review video, video is off on this
 *   deploy, or the shop is on the free plan while paid upgrades are not open.
 */
export type VideoTipKind = "upload" | "pro";

export const SHOP_VIDEO_EDITOR_PATH = "/account/storefront#shop-video";

const HAS_VIDEO_STATUSES = new Set<string>(["approved", ...IN_FLIGHT_STATUSES]);

export function videoTipKind(input: {
  videoMode: VideoMode;
  proActive: boolean;
  paymentsLive: boolean;
  videos: { status: string }[];
}): VideoTipKind | null {
  if (input.videoMode === "off") return null;
  if (input.videos.some((video) => HAS_VIDEO_STATUSES.has(video.status))) return null;
  if (input.proActive) return "upload";
  if (input.paymentsLive) return "pro";
  return null;
}

/**
 * Opens the seller's own shop video section. Signed in: /login sends them straight on.
 * Signed out: they sign in and land on the same section.
 */
export function shopVideoEditorUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/login?next=${encodeURIComponent(SHOP_VIDEO_EDITOR_PATH)}`;
}

export const VIDEO_TIP_TITLE = "Add a short shop video";
export const VIDEO_TIP_WHY =
  "A short video lets buyers see your shop and the people behind it, which helps them trust you and choose you.";
export const VIDEO_TIP_PRO_NOTE = "Shop video comes with the Verified Pro plan. Once the plan is on:";
export const VIDEO_TIP_STEPS = [
  "1. Film up to 45 seconds on your phone: your shop, your work, and a warm hello.",
  "2. Open the link below, sign in if asked, and choose the clip. MP4 or MOV, and iPhone video is fine.",
  "3. Tick the consent box and upload. The video shows on your shop once the Rangach team has reviewed it.",
] as const;

export function videoTipLines(kind: VideoTipKind | null, origin: string): string[] {
  if (!kind) return [];
  const url = shopVideoEditorUrl(origin);
  const lines = [VIDEO_TIP_TITLE, VIDEO_TIP_WHY];
  if (kind === "pro") lines.push(VIDEO_TIP_PRO_NOTE);
  lines.push(...VIDEO_TIP_STEPS);
  lines.push(kind === "pro" ? `See shop video and the Pro plan: ${url}` : `Add your shop video: ${url}`);
  return lines;
}
