import { createHmac } from "node:crypto";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { sellerTipsPrompt, type SellerTipsResult } from "@/lib/ai/prompts/seller-tips";
import { runAi } from "@/lib/ai/run";
import { statRetentionCutoff } from "@/lib/stats/retention";
import { canSendTips, sendTipEmail, type TipEmail } from "@/lib/email/zeptomail";
import { defaultSiteUrl } from "@/lib/brand";
import type { AiActor, RunResult } from "@/lib/ai/types";
import { showDemoShops } from "@/lib/demo-visibility";
import { DEMO_EMAIL_DOMAIN } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export type WeekCounts = {
  listingViews: number;
  shopViews: number;
  whatsappTaps: number;
  callTaps: number;
};

export type ListingHygiene = {
  missingPhoto: number;
  noPrice: number;
  shortDescription: number;
  noOfferings: number;
  noOccasion: number;
  listings: number;
};

export type TipSeller = {
  userId: string;
  email: string;
  name: string;
  storefrontId: string;
  tipsEmailOptIn: boolean;
  alreadySent: boolean;
  statsJson: string;
};

export type TipRow = {
  userId: string;
  storefrontId: string;
  weekStart: Date;
  statsJson: string;
  tipsJson: string;
  source: "ai" | "rules";
  emailedAt: Date | null;
  createdAt: Date;
};

export type TipsRunner = (
  spec: typeof sellerTipsPrompt,
  input: { statsJson: string },
  actor?: AiActor,
  deps?: { env?: NodeJS.ProcessEnv },
) => Promise<RunResult<SellerTipsResult>>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SELLER_CAP = 100;
const SHORT_DESCRIPTION = 40;

export function weekStartUtc(now: Date): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date;
}

export function sellerStatsJson(current: WeekCounts, previous: WeekCounts, hygiene: ListingHygiene): string {
  return JSON.stringify({ current, previous, hygiene });
}

export function ruleTips(hygiene: ListingHygiene): SellerTipsResult {
  const tips: SellerTipsResult["tips"] = [];
  if (hygiene.missingPhoto > 0) {
    tips.push({
      title: "Add a photo",
      body: `${hygiene.missingPhoto} listings have no photo.`,
      action: "add_photo",
    });
  }
  if (hygiene.noPrice > 0) {
    tips.push({
      title: "Add a price",
      body: `${hygiene.noPrice} listings have no price.`,
      action: "set_price",
    });
  }
  if (hygiene.shortDescription > 0 && tips.length < 3) {
    tips.push({
      title: "Say a bit more",
      body: `${hygiene.shortDescription} listings have a very short description.`,
      action: "improve_title",
    });
  }
  if (hygiene.noOfferings > 0 && tips.length < 3) {
    tips.push({
      title: "Add an offering",
      body: `${hygiene.noOfferings} shops have no offering.`,
      action: "add_offering",
    });
  }
  if (hygiene.noOccasion > 0 && tips.length < 3) {
    tips.push({
      title: "Tag an occasion",
      body: `${hygiene.noOccasion} listings are not tagged to an occasion.`,
      action: "join_occasion",
    });
  }
  return {
    summary: tips.length > 0 ? "A few things would help buyers find you." : "No change to suggest from the checklist.",
    tips: tips.slice(0, 3),
  };
}

export function unsubscribeToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

export function unsubscribeUrl(origin: string, userId: string, secret: string): string {
  const token = unsubscribeToken(userId, secret);
  return `${origin.replace(/\/$/, "")}/api/ai/tips-unsubscribe?user=${encodeURIComponent(userId)}&token=${token}`;
}

export function tipEmailText(name: string, result: SellerTipsResult, unsubscribe: string): string {
  const hello = name.trim() ? `Hello ${name.trim()},` : "Hello,";
  const lines = [hello, "", result.summary.trim()];
  for (const tip of result.tips) lines.push("", `${tip.title}: ${tip.body}`);
  lines.push("", "This note is about your own Rangach page. It does not contact buyers for you.");
  lines.push("", `Unsubscribe: ${unsubscribe}`);
  return lines.join("\n");
}

export async function loadTipSellers(now: Date): Promise<TipSeller[]> {
  const weekStart = weekStartUtc(now);
  const currentSince = new Date(now.getTime() - WEEK_MS);
  const previousSince = new Date(now.getTime() - 2 * WEEK_MS);
  const [users, sent, events] = await Promise.all([
    prisma.user.findMany({
      where: {
        storefront: { is: { published: true } },
        ...(showDemoShops() ? {} : { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        storefront: { select: { id: true, offerings: { where: { archived: false }, select: { id: true } } } },
        listings: {
          select: {
            id: true,
            photoUrl: true,
            priceLabel: true,
            description: true,
            occasions: { select: { id: true } },
            ...{ ["hidden"]: true as const },
          },
        },
      },
      take: SELLER_CAP,
    }),
    prisma.sellerTip.findMany({ where: { weekStart }, select: { userId: true } }),
    prisma.statEvent.findMany({
      where: { createdAt: { gte: previousSince } },
      select: { kind: true, listingId: true, storefrontId: true, createdAt: true },
    }),
  ]);
  const sentIds = new Set(sent.map((row) => row.userId));
  const sellers: TipSeller[] = [];
  for (const user of users) {
    if (!user.email.includes("@") || !user.storefront) continue;
    const listingIds = new Set(user.listings.map((listing) => listing.id));
    const shopId = user.storefront.id;
    const current = emptyCounts();
    const previous = emptyCounts();
    let seen = 0;
    for (const event of events) {
      const mine =
        (event.listingId && listingIds.has(event.listingId)) || (event.storefrontId && event.storefrontId === shopId);
      if (!mine) continue;
      seen += 1;
      const bucket = event.createdAt.getTime() >= currentSince.getTime() ? current : previous;
      addEvent(bucket, event.kind, Boolean(event.listingId && listingIds.has(event.listingId)));
    }
    if (seen === 0) continue;
    const prefs = await prisma.sellerAiPrefs.findUnique({ where: { userId: user.id }, select: { tipsEmailOptIn: true } });
    const visible = user.listings.filter((listing) => (listing as { hidden?: boolean }).hidden !== true);
    sellers.push({
      userId: user.id,
      email: user.email,
      name: user.name,
      storefrontId: shopId,
      tipsEmailOptIn: prefs?.tipsEmailOptIn ?? false,
      alreadySent: sentIds.has(user.id),
      statsJson: sellerStatsJson(current, previous, hygieneFor(visible, user.storefront.offerings.length)),
    });
  }
  return sellers;
}

function emptyCounts(): WeekCounts {
  return { listingViews: 0, shopViews: 0, whatsappTaps: 0, callTaps: 0 };
}

function addEvent(bucket: WeekCounts, kind: string, onListing: boolean) {
  if (onListing && kind === "listing_view") bucket.listingViews += 1;
  if (!onListing && kind === "shop_view") bucket.shopViews += 1;
  if (kind === "whatsapp_tap") bucket.whatsappTaps += 1;
  if (kind === "call_tap") bucket.callTaps += 1;
}

function hygieneFor(
  listings: { photoUrl: string; priceLabel: string; description: string; occasions: { id: string }[] }[],
  offerings: number,
): ListingHygiene {
  return {
    listings: listings.length,
    missingPhoto: listings.filter((listing) => !listing.photoUrl.trim()).length,
    noPrice: listings.filter((listing) => !listing.priceLabel.trim()).length,
    shortDescription: listings.filter((listing) => listing.description.trim().length < SHORT_DESCRIPTION).length,
    noOfferings: offerings === 0 ? 1 : 0,
    noOccasion: listings.filter((listing) => listing.occasions.length === 0).length,
  };
}

export async function runWeeklySellerTips(
  deps: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
    origin?: string;
    featureOn?: () => Promise<boolean>;
    sellers?: TipSeller[];
    run?: TipsRunner;
    send?: (message: TipEmail) => Promise<"sent" | "skipped" | "failed">;
    save?: (row: TipRow) => Promise<void>;
    markEmailed?: (userId: string, weekStart: Date, at: Date) => Promise<void>;
    purge?: (cutoff: Date) => Promise<number>;
  } = {},
): Promise<{ emailed: number; drafted: number; reason: "off" | "ran" }> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? process.env;
  try {
    await (deps.purge ?? (async (cutoff) => {
      const { purgeStatEventsBefore } = await import("@/lib/stats/retention");
      return purgeStatEventsBefore(cutoff);
    }))(statRetentionCutoff(now));
  } catch {
    // A failed cleanup does not block tips, and it does not send mail.
  }

  const featureOn = deps.featureOn ?? (() => isAiFeatureOn("seller_tips", { env }));
  if (!(await featureOn())) return { emailed: 0, drafted: 0, reason: "off" };

  const sellers = (deps.sellers ?? (await loadTipSellers(now))).filter((seller) => !seller.alreadySent).slice(0, SELLER_CAP);
  const run = deps.run ?? runAi;
  const send = deps.send ?? ((message: TipEmail) => sendTipEmail(message, { env }));
  const save =
    deps.save ??
    (async (row: TipRow) => {
      await prisma.sellerTip.create({ data: row });
    });
  const markEmailed =
    deps.markEmailed ??
    (async (userId: string, weekStart: Date, at: Date) => {
      await prisma.sellerTip.updateMany({ where: { userId, weekStart }, data: { emailedAt: at } });
    });
  const origin = deps.origin ?? defaultSiteUrl();
  const secret = env.CRON_SECRET?.trim() || env.AUTH_SECRET?.trim() || "";

  let emailed = 0;
  let drafted = 0;
  for (const seller of sellers) {
    const result = await run(sellerTipsPrompt, { statsJson: seller.statsJson }, { userId: seller.userId }, { env });
    if (!result.ok || result.data.tips.length === 0) continue;
    const weekStart = weekStartUtc(now);
    try {
      await save({
        userId: seller.userId,
        storefrontId: seller.storefrontId,
        weekStart,
        statsJson: seller.statsJson,
        tipsJson: JSON.stringify(result.data),
        source: "ai",
        emailedAt: null,
        createdAt: now,
      });
    } catch {
      continue;
    }
    drafted += 1;
    if (!seller.tipsEmailOptIn || !canSendTips(env) || !secret) continue;
    const delivery = await send({
      to: seller.email,
      name: seller.name,
      subject: "Your week on Rangach",
      text: tipEmailText(seller.name, result.data, unsubscribeUrl(origin, seller.userId, secret)),
    });
    if (delivery !== "sent") continue;
    try {
      await markEmailed(seller.userId, weekStart, now);
      emailed += 1;
    } catch {
      // The row already blocks a second send this week.
    }
  }
  return { emailed, drafted, reason: "ran" };
}

export async function setTipsEmailOptIn(userId: string, optedIn: boolean): Promise<void> {
  await prisma.sellerAiPrefs.upsert({
    where: { userId },
    create: { userId, tipsEmailOptIn: optedIn },
    update: { tipsEmailOptIn: optedIn },
  });
}
