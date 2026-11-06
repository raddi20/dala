import { defaultSiteUrl } from "@/lib/brand";
import { canSendMail, sendMail, type TipEmail } from "@/lib/email/zeptomail";
import { prisma } from "@/lib/prisma";
import { shouldSkipSellerEmail } from "@/lib/seller-mail/demo";
import { computeShopGaps, gapTips, shopLooksComplete, visibilityDue, type ShopGaps } from "@/lib/seller-mail/gaps";
import { visibilityUnsubscribeUrl } from "@/lib/seller-mail/unsubscribe";

export const VISIBILITY_SELLER_CAP = 40;

export type VisibilitySeller = {
  userId: string;
  storefrontId: string;
  email: string;
  name: string;
  slug: string;
  optOut: boolean;
  lastSentAt: Date | null;
  gaps: ShopGaps;
};

export function canSendVisibilityEmail(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SELLER_VISIBILITY_EMAIL === "1" && canSendMail(env);
}

export function visibilityEmailText(input: {
  name: string;
  shopUrl: string;
  tips: { title: string; body: string }[];
  unsubscribe: string;
}): string {
  const who = input.name.trim() || "there";
  const lines = [
    `Hello ${who},`,
    "",
    "A short note to help more buyers find your shop on Rangach.",
    "",
    `Your shop: ${input.shopUrl}`,
  ];
  for (const tip of input.tips) {
    lines.push("", `${tip.title}: ${tip.body}`);
  }
  lines.push(
    "",
    "Open Account → Share for ready captions, a branded card, and short tips on posting to WhatsApp, Instagram, Facebook, X, and TikTok. You post yourself — we do not connect to your accounts.",
    "",
    `Unsubscribe: ${input.unsubscribe}`,
    "",
    "Rangach",
  );
  return lines.join("\n");
}

export async function loadVisibilitySellers(now: Date): Promise<VisibilitySeller[]> {
  const shops = await prisma.storefront.findMany({
    where: { published: true, hidden: false },
    select: {
      id: true,
      slug: true,
      bannerUrl: true,
      visibilityEmailOptOut: true,
      lastVisibilityEmailAt: true,
      instagramHandle: true,
      facebookHandle: true,
      xHandle: true,
      tiktokHandle: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          phone: true,
          whatsapp: true,
          suspended: true,
          listings: { where: { hidden: false }, select: { photoUrl: true } },
        },
      },
      offerings: { where: { archived: false }, select: { imageUrl: true } },
      branches: { select: { hours: true, phone: true } },
    },
    take: 200,
  });

  const sellers: VisibilitySeller[] = [];
  for (const shop of shops) {
    if (shop.user.suspended) continue;
    if (shouldSkipSellerEmail({ email: shop.user.email, shopName: shop.user.name })) continue;
    const hasSocialHandle = Boolean(
      shop.instagramHandle.trim() || shop.facebookHandle.trim() || shop.xHandle.trim() || shop.tiktokHandle.trim(),
    );
    const gaps = computeShopGaps({
      bannerUrl: shop.bannerUrl,
      bio: shop.user.bio,
      phone: shop.user.phone,
      whatsapp: shop.user.whatsapp,
      offerings: shop.offerings,
      listings: shop.user.listings,
      branches: shop.branches,
      hasSocialHandle,
    });
    const complete = shopLooksComplete(gaps);
    if (!visibilityDue({ now, lastSentAt: shop.lastVisibilityEmailAt, complete })) continue;
    sellers.push({
      userId: shop.user.id,
      storefrontId: shop.id,
      email: shop.user.email,
      name: shop.user.name,
      slug: shop.slug,
      optOut: shop.visibilityEmailOptOut,
      lastSentAt: shop.lastVisibilityEmailAt,
      gaps,
    });
  }
  return sellers;
}

export async function runVisibilityTips(
  deps: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
    origin?: string;
    sellers?: VisibilitySeller[];
    send?: (message: TipEmail) => Promise<"sent" | "skipped" | "failed">;
    markSent?: (storefrontId: string, at: Date) => Promise<void>;
  } = {},
): Promise<{ emailed: number; skipped: number; reason: "off" | "ran" }> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? process.env;
  if (!canSendVisibilityEmail(env)) return { emailed: 0, skipped: 0, reason: "off" };

  const secret = env.CRON_SECRET?.trim() || env.AUTH_SECRET?.trim() || "";
  if (!secret) return { emailed: 0, skipped: 0, reason: "off" };

  const sellers = (deps.sellers ?? (await loadVisibilitySellers(now)))
    .filter((seller) => !seller.optOut)
    .slice(0, VISIBILITY_SELLER_CAP);

  const send = deps.send ?? ((message: TipEmail) => sendMail(message, { env }));
  const markSent =
    deps.markSent ??
    (async (storefrontId: string, at: Date) => {
      await prisma.storefront.update({ where: { id: storefrontId }, data: { lastVisibilityEmailAt: at } });
    });
  const origin = deps.origin ?? defaultSiteUrl();

  let emailed = 0;
  let skipped = 0;
  for (const seller of sellers) {
    const tips = gapTips(seller.gaps);
    if (tips.length === 0) {
      skipped += 1;
      continue;
    }
    const shopUrl = `${origin.replace(/\/$/, "")}/b/${encodeURIComponent(seller.slug)}`;
    const delivery = await send({
      to: seller.email,
      name: seller.name,
      subject: "A few tips for your Rangach shop",
      text: visibilityEmailText({
        name: seller.name,
        shopUrl,
        tips,
        unsubscribe: visibilityUnsubscribeUrl(origin, seller.userId, secret),
      }),
    });
    if (delivery !== "sent") {
      skipped += 1;
      continue;
    }
    try {
      await markSent(seller.storefrontId, now);
      emailed += 1;
    } catch {
      skipped += 1;
    }
  }
  return { emailed, skipped, reason: "ran" };
}

export async function setVisibilityEmailOptOut(userId: string, optOut: boolean): Promise<void> {
  await prisma.storefront.updateMany({ where: { userId }, data: { visibilityEmailOptOut: optOut } });
}
