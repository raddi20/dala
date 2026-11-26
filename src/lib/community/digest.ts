import { isDemoEmail } from "@/lib/admin-access";

export const DIGEST_CAP = 40;
export const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type DigestUpdate = { body: string; createdAt: Date };
export type DigestListing = { id: string; title: string; createdAt: Date };

export type DigestShop = {
  name: string;
  slug: string;
  ownerEmail: string;
  updates: DigestUpdate[];
  listings: DigestListing[];
};

export type DigestRecipient = {
  userId: string;
  email: string;
  name: string;
  optOut: boolean;
  suspended: boolean;
  shops: DigestShop[];
};

export function weekStart(now: Date): Date {
  return new Date(now.getTime() - DIGEST_WINDOW_MS);
}

/** Drops demo shops and anything older than the window. Empty shops are skipped. */
export function digestShops(shops: DigestShop[], since: Date): DigestShop[] {
  const out: DigestShop[] = [];
  for (const shop of shops) {
    if (isDemoEmail(shop.ownerEmail)) continue;
    const updates = shop.updates.filter((row) => row.createdAt.getTime() >= since.getTime());
    const listings = shop.listings.filter((row) => row.createdAt.getTime() >= since.getTime());
    if (updates.length + listings.length === 0) continue;
    out.push({ ...shop, updates, listings });
  }
  return out;
}

export function shouldEmailDigest(input: DigestRecipient, since: Date): boolean {
  if (input.optOut || input.suspended) return false;
  const email = input.email.trim();
  if (!email.includes("@") || isDemoEmail(email)) return false;
  return digestShops(input.shops, since).length > 0;
}

export function digestEmailText(input: {
  name: string;
  shops: DigestShop[];
  origin: string;
  unsubscribe: string;
}): string {
  const who = input.name.trim() || "there";
  const origin = input.origin.replace(/\/$/, "");
  const lines = [
    `Hello ${who},`,
    "",
    "Here is what is new from shops you follow.",
  ];
  for (const shop of input.shops) {
    lines.push("", shop.name, `${origin}/b/${shop.slug}`);
    for (const update of shop.updates) lines.push(update.body);
    for (const listing of shop.listings) {
      lines.push(`New listing: ${listing.title}`, `${origin}/listings/${listing.id}`);
    }
  }
  lines.push(
    "",
    "Open the shop when you want it. This is the only note this week, and only when something is new.",
    "",
    `Stop these notes: ${input.unsubscribe}`,
    "",
    "Rangach",
  );
  return lines.join("\n");
}

export function digestSubject(): string {
  return "New from shops you follow";
}
