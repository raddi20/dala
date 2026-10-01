import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { runModeration, SWEEP_BATCH, unhashedPhotoTargets } from "@/lib/ai/moderation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.MOD_PHOTO_HASH !== "1") return NextResponse.json({ hashed: 0, reason: "off" });
  try {
    const [listings, offerings, shops, hashes] = await Promise.all([
      prisma.listing.findMany({ where: { photoUrl: { not: "" } }, select: { id: true, photoUrl: true }, take: 1000 }),
      prisma.offering.findMany({ where: { imageUrl: { not: "" } }, select: { id: true, imageUrl: true }, take: 1000 }),
      prisma.storefront.findMany({ where: { bannerUrl: { not: "" } }, select: { id: true, bannerUrl: true }, take: 1000 }),
      prisma.mediaHash.findMany({ select: { ownerType: true, ownerId: true }, take: 5000 }),
    ]);
    const existing = new Set(hashes.map((row) => `${row.ownerType}:${row.ownerId}`));
    const targets = unhashedPhotoTargets(
      existing,
      [
        ...listings.map((row) => ({ ownerType: "listing", ownerId: row.id, url: row.photoUrl })),
        ...offerings.map((row) => ({ ownerType: "offering", ownerId: row.id, url: row.imageUrl })),
        ...shops.map((row) => ({ ownerType: "storefront_banner", ownerId: row.id, url: row.bannerUrl })),
      ],
      SWEEP_BATCH,
    );
    let hashed = 0;
    for (const row of targets) {
      const targetType = row.ownerType === "storefront_banner" ? "storefront" : row.ownerType;
      if (targetType !== "listing" && targetType !== "offering" && targetType !== "storefront") continue;
      const result = await runModeration(
        { targetType, targetId: row.ownerId },
        { env: process.env, featureOn: async () => false, hashOnly: true },
      );
      if (result.flags > 0 || result.status === "clean" || result.status === "open") hashed += 1;
    }
    return NextResponse.json({ hashed });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
