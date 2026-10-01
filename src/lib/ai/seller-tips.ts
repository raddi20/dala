import { isAiFeatureOn } from "@/lib/ai/flags";
import { sellerTipsPrompt, type SellerTipsResult } from "@/lib/ai/prompts/seller-tips";
import { runAi } from "@/lib/ai/run";
import { statRetentionCutoff } from "@/lib/stats/retention";
import { canSendTips, sendTipEmail, type TipEmail } from "@/lib/ai/zeptomail";
import type { AiActor, RunResult } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

export type TipSeller = {
  userId: string;
  email: string;
  name: string;
  listingViews: number;
  shopViews: number;
  whatsappTaps: number;
  callTaps: number;
  listingCount: number;
  alreadySent: boolean;
};

export type TipRow = {
  userId: string;
  weekStart: string;
  summary: string;
  tipsJson: string;
  emailed: boolean;
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

export function weekStartUtc(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

export function sellerStatsJson(seller: TipSeller): string {
  return JSON.stringify({
    listingViews: seller.listingViews,
    shopViews: seller.shopViews,
    whatsappTaps: seller.whatsappTaps,
    callTaps: seller.callTaps,
    listings: seller.listingCount,
  });
}

export function tipEmailText(name: string, result: SellerTipsResult): string {
  const hello = name.trim() ? `Hello ${name.trim()},` : "Hello,";
  const lines = [hello, "", result.summary.trim()];
  for (const tip of result.tips) {
    lines.push("", `${tip.title}: ${tip.body}`);
  }
  lines.push("", "This note is about your own Rangach page. It does not contact buyers for you.");
  return lines.join("\n");
}

export async function loadTipSellers(now: Date): Promise<TipSeller[]> {
  const weekStart = weekStartUtc(now);
  const since = new Date(now.getTime() - WEEK_MS);
  const [users, sent, counts] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [{ listings: { some: { hidden: false } } }, { storefront: { is: { published: true } } }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        listings: { where: { hidden: false }, select: { id: true } },
        storefront: { select: { id: true, published: true } },
      },
      take: SELLER_CAP,
    }),
    prisma.aiSellerTip.findMany({ where: { weekStart }, select: { userId: true } }),
    prisma.statEvent.groupBy({
      by: ["kind", "listingId", "storefrontId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const sentIds = new Set(sent.map((row) => row.userId));
  return users
    .filter((user) => user.email.includes("@"))
    .map((user) => {
      const listingIds = new Set(user.listings.map((listing) => listing.id));
      const shopId = user.storefront?.published ? user.storefront.id : "";
      let listingViews = 0;
      let shopViews = 0;
      let whatsappTaps = 0;
      let callTaps = 0;
      for (const row of counts) {
        const n = row._count._all;
        if (row.listingId && listingIds.has(row.listingId) && row.kind === "listing_view") listingViews += n;
        if (shopId && row.storefrontId === shopId) {
          if (row.kind === "shop_view") shopViews += n;
          if (row.kind === "whatsapp_tap") whatsappTaps += n;
          if (row.kind === "call_tap") callTaps += n;
        }
      }
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        listingViews,
        shopViews,
        whatsappTaps,
        callTaps,
        listingCount: listingIds.size,
        alreadySent: sentIds.has(user.id),
      };
    });
}

export async function runWeeklySellerTips(
  deps: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
    featureOn?: () => Promise<boolean>;
    sellers?: TipSeller[];
    run?: TipsRunner;
    send?: (message: TipEmail) => Promise<"sent" | "skipped" | "failed">;
    save?: (row: TipRow) => Promise<void>;
    purge?: (cutoff: Date) => Promise<number>;
  } = {},
): Promise<{ emailed: number; drafted: number; reason: "off" | "email_off" | "ran" }> {
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
  if (!canSendTips(env)) return { emailed: 0, drafted: 0, reason: "email_off" };

  const sellers = (deps.sellers ?? (await loadTipSellers(now))).filter((seller) => !seller.alreadySent).slice(0, SELLER_CAP);
  const run = deps.run ?? runAi;
  const send = deps.send ?? ((message: TipEmail) => sendTipEmail(message, { env }));
  const save =
    deps.save ??
    (async (row: TipRow) => {
      await prisma.aiSellerTip.create({ data: row });
    });

  let emailed = 0;
  let drafted = 0;
  for (const seller of sellers) {
    const statsJson = sellerStatsJson(seller);
    const result = await run(sellerTipsPrompt, { statsJson }, { userId: seller.userId }, { env });
    if (!result.ok || result.data.tips.length === 0) continue;
    drafted += 1;
    const delivery = await send({
      to: seller.email,
      name: seller.name,
      subject: "Your week on Rangach",
      text: tipEmailText(seller.name, result.data),
    });
    if (delivery !== "sent") continue;
    try {
      await save({
        userId: seller.userId,
        weekStart: weekStartUtc(now),
        summary: result.data.summary,
        tipsJson: JSON.stringify(result.data.tips),
        emailed: true,
        createdAt: now,
      });
      emailed += 1;
    } catch {
      // A second run this week hits the unique row and does not send again.
    }
  }
  return { emailed, drafted, reason: "ran" };
}
