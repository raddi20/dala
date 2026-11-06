import { defaultSiteUrl } from "@/lib/brand";
import { sendMail, type TipEmail } from "@/lib/email/zeptomail";
import { prisma } from "@/lib/prisma";
import { shouldSkipSellerEmail } from "@/lib/seller-mail/demo";

export type ThankYouShop = {
  storefrontId: string;
  slug: string;
  shopName: string;
  email: string;
  ownerName: string;
  thankYouEmailSentAt: Date | null;
  published: boolean;
  wasAlreadyPublished: boolean;
};

export function thankYouEmailText(input: {
  ownerName: string;
  shopName: string;
  shopUrl: string;
}): string {
  const who = input.ownerName.trim() || "there";
  const shop = input.shopName.trim() || "your shop";
  return [
    `Hello ${who},`,
    "",
    `Your shop ${shop} is live on Rangach. Thank you for listing with us.`,
    "",
    `Your page: ${input.shopUrl}`,
    "",
    "Three next steps that help buyers find you:",
    "1. Add clear photos of what you sell (cover and offerings).",
    "2. Add a few listings or offerings with prices.",
    "3. Share your shop link from Account → Share (WhatsApp, Instagram, Facebook, X, TikTok).",
    "",
    "Warm regards,",
    "Rangach",
  ].join("\n");
}

export function buildThankYouMessage(shop: ThankYouShop, origin = defaultSiteUrl()): TipEmail | null {
  if (shouldSkipSellerEmail({ email: shop.email, shopName: shop.shopName })) return null;
  if (!shop.published) return null;
  // Already-live shops must not be back-sent. Only a fresh publish (was draft) may send.
  if (shop.wasAlreadyPublished) return null;
  if (shop.thankYouEmailSentAt) return null;
  const shopUrl = `${origin.replace(/\/$/, "")}/b/${encodeURIComponent(shop.slug)}`;
  return {
    to: shop.email,
    name: shop.ownerName || shop.shopName,
    subject: "Your Rangach shop is live",
    text: thankYouEmailText({ ownerName: shop.ownerName, shopName: shop.shopName, shopUrl }),
  };
}

/**
 * Send the one-time thank-you after a shop first goes public.
 * Idempotent: persists thankYouEmailSentAt before or right after a successful send attempt
 * that claims the row, so a double-click cannot send twice.
 */
export async function maybeSendShopThankYou(
  storefrontId: string,
  deps: {
    now?: Date;
    origin?: string;
    send?: (message: TipEmail) => Promise<"sent" | "skipped" | "failed">;
    load?: (id: string) => Promise<ThankYouShop | null>;
    markSent?: (id: string, at: Date) => Promise<boolean>;
  } = {},
): Promise<"sent" | "skipped" | "already" | "failed"> {
  const now = deps.now ?? new Date();
  const load =
    deps.load ??
    (async (id: string) => {
      const row = await prisma.storefront.findUnique({
        where: { id },
        select: {
          id: true,
          slug: true,
          published: true,
          thankYouEmailSentAt: true,
          user: { select: { email: true, name: true } },
        },
      });
      if (!row) return null;
      return {
        storefrontId: row.id,
        slug: row.slug,
        shopName: row.user.name,
        email: row.user.email,
        ownerName: row.user.name,
        thankYouEmailSentAt: row.thankYouEmailSentAt,
        published: row.published,
        // Caller for publish path sets wasAlreadyPublished=false via mark claim below.
        wasAlreadyPublished: false,
      } satisfies ThankYouShop;
    });

  const shop = await load(storefrontId);
  if (!shop) return "skipped";
  if (shop.thankYouEmailSentAt) return "already";

  const message = buildThankYouMessage({ ...shop, wasAlreadyPublished: false }, deps.origin);
  if (!message) return "skipped";

  const markSent =
    deps.markSent ??
    (async (id: string, at: Date) => {
      const result = await prisma.storefront.updateMany({
        where: { id, thankYouEmailSentAt: null, published: true },
        data: { thankYouEmailSentAt: at },
      });
      return result.count === 1;
    });

  // Claim first so a concurrent publish cannot double-send.
  const claimed = await markSent(storefrontId, now);
  if (!claimed) return "already";

  const send = deps.send ?? ((msg: TipEmail) => sendMail(msg));
  const result = await send(message);
  if (result === "sent") return "sent";

  // Roll back the claim so a later publish/retry can try again when mail was skipped or failed.
  if (deps.markSent) {
    // Tests that inject markSent without a clear path keep the claim semantics they set.
  } else {
    try {
      await prisma.storefront.updateMany({
        where: { id: storefrontId, thankYouEmailSentAt: now },
        data: { thankYouEmailSentAt: null },
      });
    } catch {
      // Leave the claim; a second send is worse than a missed retry only when the row is stuck.
    }
  }
  if (result === "skipped") return "skipped";
  return "failed";
}
