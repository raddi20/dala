import { defaultSiteUrl } from "@/lib/brand";
import { sendMail, type TipEmail } from "@/lib/email/zeptomail";
import { prisma } from "@/lib/prisma";
import { shouldSkipSellerEmail } from "@/lib/seller-mail/demo";
import { thankYouEmailText, type ThankYouShop } from "@/lib/seller-mail/thank-you";

export const THANK_YOU_BACKFILL_CAP = 500;

export type BackfillCandidate = ThankYouShop;

/**
 * Backfill-only body: the go-live thank-you, plus a short note about Share & promote,
 * the visibility checklist, and weekly tip emails. New shops keep thankYouEmailText alone.
 */
export function backfillThankYouEmailText(input: {
  ownerName: string;
  shopName: string;
  shopUrl: string;
  origin?: string;
}): string {
  const origin = (input.origin ?? "https://www.rangach.co.ke").replace(/\/$/, "");
  const shareUrl = `${origin}/account/share`;
  const accountUrl = `${origin}/account`;
  const base = thankYouEmailText({
    ownerName: input.ownerName,
    shopName: input.shopName,
    shopUrl: input.shopUrl,
  });
  // Drop the closing "Warm regards, / Rangach" so we can add the marketing note before it.
  const withoutSignoff = base.replace(/\nWarm regards,\nRangach\s*$/, "").trimEnd();
  const marketing = [
    "",
    "New in your account: Share & promote.",
    `Open ${shareUrl} (also from ${accountUrl}) for ready captions and a branded card for WhatsApp, Instagram, Facebook, X, and TikTok. Each post can carry your Rangach shop link, your own social handles, and Rangach on Instagram, X, and TikTok (@rangachke) plus the Rangach Facebook Page.`,
    "",
    "How to use it:",
    "1. Open Share & promote.",
    "2. Pick WhatsApp, Instagram, Facebook, X, or TikTok.",
    "3. Copy the ready caption (it already has your Rangach shop link, your handles when saved, and Rangach’s socials).",
    "4. Download or save the branded card, then post from your own account.",
    "You post yourself — we do not connect to or post on your social accounts.",
    "",
    `On ${accountUrl} you will also find a short visibility checklist (photos, listings, hours, handles, and sharing your link). From time to time we may send a weekly tip email about gaps on your shop; every tip note includes an unsubscribe link.`,
    "",
    "Warm regards,",
    "Rangach",
  ].join("\n");
  return `${withoutSignoff}\n${marketing}`;
}

/**
 * One-shot email for shops that were already public when thank-you shipped.
 * Skips demo / no-email / already-sent. Uses the backfill body (thank-you + marketing note).
 * Go-live for brand-new shops still uses thankYouEmailText only.
 */
export function buildBackfillThankYouMessage(
  shop: BackfillCandidate,
  origin = defaultSiteUrl(),
): TipEmail | null {
  if (shouldSkipSellerEmail({ email: shop.email, shopName: shop.shopName })) return null;
  if (!shop.published) return null;
  if (shop.thankYouEmailSentAt) return null;
  const baseOrigin = origin.replace(/\/$/, "");
  const shopUrl = `${baseOrigin}/b/${encodeURIComponent(shop.slug)}`;
  return {
    to: shop.email,
    name: shop.ownerName || shop.shopName,
    subject: "Your Rangach shop is live",
    text: backfillThankYouEmailText({
      ownerName: shop.ownerName,
      shopName: shop.shopName,
      shopUrl,
      origin: baseOrigin,
    }),
  };
}

export function isEligibleForThankYouBackfill(shop: BackfillCandidate): boolean {
  return buildBackfillThankYouMessage(shop, "https://www.rangach.co.ke") !== null;
}

export async function loadThankYouBackfillCandidates(): Promise<BackfillCandidate[]> {
  const rows = await prisma.storefront.findMany({
    where: {
      published: true,
      hidden: false,
      thankYouEmailSentAt: null,
    },
    select: {
      id: true,
      slug: true,
      published: true,
      thankYouEmailSentAt: true,
      user: { select: { email: true, name: true, suspended: true } },
    },
    take: THANK_YOU_BACKFILL_CAP * 2,
  });

  const candidates: BackfillCandidate[] = [];
  for (const row of rows) {
    if (row.user.suspended) continue;
    const shop: BackfillCandidate = {
      storefrontId: row.id,
      slug: row.slug,
      shopName: row.user.name,
      email: row.user.email,
      ownerName: row.user.name,
      thankYouEmailSentAt: row.thankYouEmailSentAt,
      published: row.published,
      wasAlreadyPublished: true,
    };
    if (!isEligibleForThankYouBackfill(shop)) continue;
    candidates.push(shop);
    if (candidates.length >= THANK_YOU_BACKFILL_CAP) break;
  }
  return candidates;
}

/**
 * One-shot backfill for existing live shops. Idempotent via thankYouEmailSentAt.
 * Does not send visibility tip emails. Safe to re-run: second call sends zero.
 */
export async function runThankYouBackfill(
  deps: {
    now?: Date;
    origin?: string;
    candidates?: BackfillCandidate[];
    send?: (message: TipEmail) => Promise<"sent" | "skipped" | "failed">;
    markSent?: (storefrontId: string, at: Date) => Promise<boolean>;
    clearSent?: (storefrontId: string, at: Date) => Promise<void>;
  } = {},
): Promise<{ emailed: number; skipped: number; already: number; failed: number; eligible: number }> {
  const now = deps.now ?? new Date();
  const origin = deps.origin ?? defaultSiteUrl();
  const candidates = deps.candidates ?? (await loadThankYouBackfillCandidates());
  const send = deps.send ?? ((message: TipEmail) => sendMail(message));
  const markSent =
    deps.markSent ??
    (async (id: string, at: Date) => {
      const result = await prisma.storefront.updateMany({
        where: { id, thankYouEmailSentAt: null, published: true },
        data: { thankYouEmailSentAt: at },
      });
      return result.count === 1;
    });
  const clearSent =
    deps.clearSent ??
    (async (id: string, at: Date) => {
      await prisma.storefront.updateMany({
        where: { id, thankYouEmailSentAt: at },
        data: { thankYouEmailSentAt: null },
      });
    });

  let emailed = 0;
  let skipped = 0;
  let already = 0;
  let failed = 0;

  for (const shop of candidates) {
    const message = buildBackfillThankYouMessage(shop, origin);
    if (!message) {
      skipped += 1;
      continue;
    }
    const claimed = await markSent(shop.storefrontId, now);
    if (!claimed) {
      already += 1;
      continue;
    }
    const result = await send(message);
    if (result === "sent") {
      emailed += 1;
      continue;
    }
    try {
      await clearSent(shop.storefrontId, now);
    } catch {
      // Leave claim if clear fails.
    }
    if (result === "skipped") skipped += 1;
    else failed += 1;
  }

  return { emailed, skipped, already, failed, eligible: candidates.length };
}

/**
 * True when the request explicitly opts into the one-shot.
 * Manual calls need ?once=1 or JSON {"once":1}.
 * Vercel Cron paths cannot reliably carry query strings, so a request with the
 * x-vercel-cron header (Vercel sets this on scheduled invocations) counts as once=1.
 * CRON_SECRET auth is still required separately via cronAuthorized.
 */
export function thankYouBackfillOnceFlag(request: Request, body: unknown): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const url = new URL(request.url);
  if (url.searchParams.get("once") === "1") return true;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const once = (body as { once?: unknown }).once;
    if (once === 1 || once === "1" || once === true) return true;
  }
  return false;
}
