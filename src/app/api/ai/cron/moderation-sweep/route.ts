import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { fingerprintPublicVideoThumb, runModeration, SWEEP_BATCH, unhashedPhotoTargets } from "@/lib/ai/moderation";
import { publicVideoThumbTargets } from "@/lib/ai/video-thumb";
import { isProActive } from "@/lib/pro";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.MOD_PHOTO_HASH !== "1") return NextResponse.json({ hashed: 0, reason: "off" });
  try {
    const [listings, offerings, shops, videos, hashes] = await Promise.all([
      prisma.listing.findMany({ where: { photoUrl: { not: "" } }, select: { id: true, photoUrl: true }, take: 1000 }),
      prisma.offering.findMany({ where: { imageUrl: { not: "" } }, select: { id: true, imageUrl: true }, take: 1000 }),
      prisma.storefront.findMany({ where: { bannerUrl: { not: "" } }, select: { id: true, bannerUrl: true }, take: 1000 }),
      prisma.shopVideo.findMany({
        where: {
          status: "approved",
          publicPlaybackId: { not: "" },
          storefront: { published: true, user: { verifiedPro: true } },
        },
        select: {
          id: true,
          status: true,
          publicPlaybackId: true,
          storefront: {
            select: { published: true, userId: true, user: { select: { verifiedPro: true, verifiedProUntil: true } } },
          },
        },
        take: 1000,
      }),
      prisma.mediaHash.findMany({ select: { ownerType: true, ownerId: true }, take: 5000 }),
    ]);
    const existing = new Set(hashes.map((row) => `${row.ownerType}:${row.ownerId}`));
    const videoThumbs = publicVideoThumbTargets(
      videos.map((row) => ({
        id: row.id,
        status: row.status,
        publicPlaybackId: row.publicPlaybackId,
        published: row.storefront.published,
        verifiedPro: isProActive(row.storefront.user),
        ownerUser: row.storefront.userId,
      })),
    );
    const targets = unhashedPhotoTargets(
      existing,
      [
        ...videoThumbs,
        ...listings.map((row) => ({ ownerType: "listing", ownerId: row.id, url: row.photoUrl, ownerUser: "" })),
        ...offerings.map((row) => ({ ownerType: "offering", ownerId: row.id, url: row.imageUrl, ownerUser: "" })),
        ...shops.map((row) => ({ ownerType: "storefront_banner", ownerId: row.id, url: row.bannerUrl, ownerUser: "" })),
      ],
      SWEEP_BATCH,
    );
    let hashed = 0;
    for (const row of targets) {
      if (row.ownerType === "video") {
        const result = await fingerprintPublicVideoThumb({
          videoId: row.ownerId,
          url: row.url,
          ownerUser: row.ownerUser,
          env: process.env,
        });
        if (result.hashed) hashed += 1;
        continue;
      }
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
