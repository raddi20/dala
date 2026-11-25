import { shouldSkipSellerEmail } from "@/lib/seller-mail/demo";
import { IN_FLIGHT_STATUSES } from "@/lib/video/constants";
import type { VideoMode } from "@/lib/video/config";

/**
 * Weekly seller emails can carry one fixed shop-video tip. The copy is written here,
 * never by the AI, so what goes out is exactly the approved text.
 *
 * Shop video is free for every shop (one clip per shop). The tip goes to every real
 * shop that has no approved or in-review video. Demo shops never get it, and nobody
 * gets it while video is off on the deploy.
 */
export const SHOP_VIDEO_EDITOR_PATH = "/account/storefront#shop-video";

const HAS_VIDEO_STATUSES = new Set<string>(["approved", ...IN_FLIGHT_STATUSES]);

export function wantsVideoTip(input: {
  videoMode: VideoMode;
  email: string;
  shopName: string;
  videos: { status: string }[];
}): boolean {
  if (input.videoMode === "off") return false;
  if (shouldSkipSellerEmail({ email: input.email, shopName: input.shopName })) return false;
  return !input.videos.some((video) => HAS_VIDEO_STATUSES.has(video.status));
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
  "A short video lets buyers see your shop and the people behind it, which helps them trust you and choose you. It is free for every shop.";
export const VIDEO_TIP_STEPS = [
  "1. Film up to 45 seconds on your phone: your shop, your work, and a warm hello.",
  "2. Open the link below, sign in if asked, and choose the clip. MP4 or MOV, and iPhone video is fine.",
  "3. Tick the consent box and upload. The video shows on your shop once the Rangach team has reviewed it.",
] as const;

export function videoTipLines(show: boolean, origin: string): string[] {
  if (!show) return [];
  return [VIDEO_TIP_TITLE, VIDEO_TIP_WHY, ...VIDEO_TIP_STEPS, `Add your shop video: ${shopVideoEditorUrl(origin)}`];
}
