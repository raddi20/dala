import { isAutomatedAgent } from "@/lib/stats/events";

export const STICKER_REF = "sticker";
export const STICKER_KICKER = "Find us on Rangach";
export const STICKER_SCAN = "Scan to see our products & WhatsApp us";
export const STICKER_HOST = "rangach.co.ke";

export type StickerSize = "a6" | "square";

export function parseStickerSize(value: string | null | undefined): StickerSize {
  return value === "square" ? "square" : "a6";
}

/** Public shop URL encoded in the sticker QR. Origin comes from the site URL. */
export function stickerTargetUrl(origin: string, slug: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/b/${encodeURIComponent(slug)}?ref=${STICKER_REF}`;
}

export function stickerFilename(slug: string, size: StickerSize, extension: "svg" | "png") {
  const safe = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "shop";
  return `rangach-${safe}-${size}.${extension}`;
}

/**
 * A published shop is public. A draft, a demo hide, an admin takedown (hidden),
 * or a shop whose owner is suspended is visible to the owner and to admins only.
 */
export function canViewSticker(input: {
  published: boolean;
  publiclyHidden: boolean;
  shopHidden: boolean;
  ownerSuspended: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  if (input.isOwner || input.isAdmin) return true;
  if (input.publiclyHidden || input.shopHidden || input.ownerSuspended) return false;
  return input.published;
}

export type StickerScanInput = {
  storefrontId: string;
  ref: string;
  userAgent: string;
  published: boolean;
  publiclyHidden: boolean;
  shopHidden: boolean;
  ownerSuspended: boolean;
  prefetch?: boolean;
};

/** True when this request should add one to the shop's sticker count. No personal data. */
export function shouldRecordStickerScan(input: StickerScanInput) {
  if (input.ref !== STICKER_REF) return false;
  if (!input.published || input.publiclyHidden || input.shopHidden || input.ownerSuspended) return false;
  if (input.prefetch) return false;
  if (isAutomatedAgent(input.userAgent)) return false;
  return true;
}

export type StickerCounter = {
  increment(storefrontId: string): Promise<void>;
};

export async function recordStickerVisit(counter: StickerCounter, input: StickerScanInput) {
  if (!shouldRecordStickerScan(input)) return false;
  await counter.increment(input.storefrontId);
  return true;
}

export function stickerScanLabel(count: number) {
  const scans = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return scans === 1 ? "1 sticker scan" : `${scans} sticker scans`;
}

export function isPrefetchRequest(header: (name: string) => string | null) {
  if (header("next-router-prefetch") === "1") return true;
  const purpose = `${header("purpose") ?? ""} ${header("sec-purpose") ?? ""}`.toLowerCase();
  return purpose.includes("prefetch");
}
