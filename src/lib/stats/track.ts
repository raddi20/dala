import { createHmac } from "node:crypto";
import { z } from "zod";
import { isAutomatedAgent, pathTarget, type StatKind } from "@/lib/stats/events";

export const VIEW_DEDUPE_MS = 30 * 60 * 1000;
export const VISITOR_LIMIT = 60;
export const VISITOR_WINDOW_MS = 60 * 1000;

export const trackBodySchema = z.object({
  kind: z.enum(["listing_view", "shop_view", "whatsapp_tap", "call_tap"]),
  path: z.string().min(1).max(300),
  visitorId: z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/),
});

export type StatRow = {
  kind: StatKind;
  listingId: string;
  storefrontId: string;
  sessionHash: string;
  createdAt: Date;
};

export type StatStore = {
  findListing(id: string): Promise<{ id: string; hidden: boolean } | null>;
  findShop(slug: string): Promise<{ id: string; published: boolean } | null>;
  countRecent(sessionHash: string, since: Date): Promise<number>;
  hasRecentView(query: { sessionHash: string; kind: StatKind; listingId: string; storefrontId: string; since: Date }): Promise<boolean>;
  insert(row: StatRow): Promise<void>;
};

export function sessionHash(salt: string, visitorId: string): string {
  return createHmac("sha256", salt).update(visitorId).digest("hex");
}

export type TrackContext = {
  trackingOn: boolean;
  salt: string;
  userAgent: string;
  now: Date;
  store: StatStore;
};

export async function handleTrack(raw: unknown, ctx: TrackContext): Promise<{ status: 204 | 400; wrote: boolean }> {
  if (!ctx.trackingOn) return { status: 204, wrote: false };
  const parsed = trackBodySchema.safeParse(raw);
  if (!parsed.success) return { status: 400, wrote: false };
  if (isAutomatedAgent(ctx.userAgent)) return { status: 204, wrote: false };
  if (!ctx.salt) return { status: 204, wrote: false };

  const hash = sessionHash(ctx.salt, parsed.data.visitorId);
  const recent = await ctx.store.countRecent(hash, new Date(ctx.now.getTime() - VISITOR_WINDOW_MS));
  if (recent >= VISITOR_LIMIT) return { status: 204, wrote: false };

  const target = pathTarget(parsed.data.path);
  if (!target) return { status: 204, wrote: false };
  if (parsed.data.kind === "listing_view" && target.kind !== "listing") return { status: 204, wrote: false };
  if (parsed.data.kind === "shop_view" && target.kind !== "shop") return { status: 204, wrote: false };

  let listingId = "";
  let storefrontId = "";
  if (target.kind === "listing") {
    const listing = await ctx.store.findListing(target.id);
    if (!listing || listing.hidden) return { status: 204, wrote: false };
    listingId = listing.id;
  } else {
    const shop = await ctx.store.findShop(target.slug);
    if (!shop || !shop.published) return { status: 204, wrote: false };
    storefrontId = shop.id;
  }

  if (parsed.data.kind === "listing_view" || parsed.data.kind === "shop_view") {
    const duplicate = await ctx.store.hasRecentView({
      sessionHash: hash,
      kind: parsed.data.kind,
      listingId,
      storefrontId,
      since: new Date(ctx.now.getTime() - VIEW_DEDUPE_MS),
    });
    if (duplicate) return { status: 204, wrote: false };
  }

  await ctx.store.insert({
    kind: parsed.data.kind,
    listingId,
    storefrontId,
    sessionHash: hash,
    createdAt: ctx.now,
  });
  return { status: 204, wrote: true };
}
