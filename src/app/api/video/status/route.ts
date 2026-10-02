import { NextResponse } from "next/server";
import { videoMode } from "@/lib/video/config";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (videoMode() === "off") return NextResponse.json({ error: "Shop video is coming soon." }, { status: 503 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to see this upload." }, { status: 401 });
  const videoId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!videoId) return NextResponse.json({ error: "Missing video." }, { status: 400 });
  const video = await prisma.shopVideo.findUnique({
    where: { id: videoId },
    select: {
      status: true,
      rejectReason: true,
      storefront: { select: { userId: true } },
    },
  });
  if (!video || video.storefront.userId !== user.id) {
    return NextResponse.json({ error: "That video was not found." }, { status: 404 });
  }
  return NextResponse.json({ status: video.status, rejectReason: video.rejectReason });
}
