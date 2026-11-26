import { DEMO_EMAIL_DOMAIN } from "@/lib/admin-access";
import { defaultSiteUrl } from "@/lib/brand";
import { digestEmailText, digestShops, digestSubject, shouldEmailDigest, weekStart, DIGEST_CAP, type DigestRecipient, type DigestShop } from "@/lib/community/digest";
import { digestUnsubscribeUrl } from "@/lib/community/unsubscribe";
import { canSendMail, sendMail, type TipEmail } from "@/lib/email/zeptomail";
import { prisma } from "@/lib/prisma";

const notDemo = { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } };

export async function loadDigestRecipients(now: Date): Promise<DigestRecipient[]> {
  const since = weekStart(now);
  const follows = await prisma.shopFollow.findMany({
    where: {
      user: { suspended: false, followDigestOptOut: false, ...notDemo },
      shop: { published: true, hidden: false, user: { suspended: false, ...notDemo } },
    },
    select: {
      user: { select: { id: true, email: true, name: true, followDigestOptOut: true, suspended: true } },
      shop: {
        select: {
          slug: true,
          user: {
            select: {
              name: true,
              email: true,
              listings: {
                where: { hidden: false, createdAt: { gte: since } },
                select: { id: true, title: true, createdAt: true },
              },
            },
          },
          updates: {
            where: { status: "approved", createdAt: { gte: since }, expiresAt: { gt: now } },
            select: { body: true, createdAt: true },
          },
        },
      },
    },
    take: 500,
  });

  const byUser = new Map<string, DigestRecipient>();
  for (const row of follows) {
    const shop: DigestShop = {
      name: row.shop.user.name,
      slug: row.shop.slug,
      ownerEmail: row.shop.user.email,
      updates: row.shop.updates,
      listings: row.shop.user.listings,
    };
    const existing = byUser.get(row.user.id);
    if (existing) {
      existing.shops.push(shop);
      continue;
    }
    byUser.set(row.user.id, {
      userId: row.user.id,
      email: row.user.email,
      name: row.user.name,
      optOut: row.user.followDigestOptOut,
      suspended: row.user.suspended,
      shops: [shop],
    });
  }
  return [...byUser.values()];
}

export function messagesForDigest(
  recipients: DigestRecipient[],
  now: Date,
  origin: string,
  secret: string,
): TipEmail[] {
  const since = weekStart(now);
  const messages: TipEmail[] = [];
  for (const person of recipients) {
    if (!shouldEmailDigest(person, since)) continue;
    const shops = digestShops(person.shops, since);
    messages.push({
      to: person.email,
      name: person.name,
      subject: digestSubject(),
      text: digestEmailText({
        name: person.name,
        shops,
        origin,
        unsubscribe: digestUnsubscribeUrl(origin, person.userId, secret),
      }),
    });
    if (messages.length >= DIGEST_CAP) break;
  }
  return messages;
}

export async function runFollowDigest(
  deps: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
    origin?: string;
    recipients?: DigestRecipient[];
    send?: (message: TipEmail) => Promise<"sent" | "skipped" | "failed">;
  } = {},
): Promise<{ emailed: number; skipped: number; reason: "off" | "ran" }> {
  const env = deps.env ?? process.env;
  if (!canSendMail(env)) return { emailed: 0, skipped: 0, reason: "off" };
  const secret = env.CRON_SECRET?.trim() || env.AUTH_SECRET?.trim() || "";
  if (!secret) return { emailed: 0, skipped: 0, reason: "off" };
  const now = deps.now ?? new Date();
  const origin = deps.origin ?? defaultSiteUrl();
  const recipients = deps.recipients ?? (await loadDigestRecipients(now));
  const messages = messagesForDigest(recipients, now, origin, secret);
  const send = deps.send ?? ((message: TipEmail) => sendMail(message, { env }));
  let emailed = 0;
  let skipped = 0;
  for (const message of messages) {
    const result = await send(message);
    if (result === "sent") emailed += 1;
    else skipped += 1;
  }
  return { emailed, skipped, reason: "ran" };
}
