import { NextResponse } from "next/server";
import { maybePurgeStatEvents } from "@/lib/stats/retention";
import { prismaStatStore } from "@/lib/stats/store";
import { handleTrack } from "@/lib/stats/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const trackingOn = process.env.STATS_TRACKING === "1";
  let body: unknown = null;
  if (trackingOn) {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }
  const outcome = await handleTrack(body, {
    trackingOn,
    salt: process.env.STATS_SALT?.trim() ?? "",
    userAgent: request.headers.get("user-agent") ?? "",
    now: new Date(),
    store: prismaStatStore(),
  });
  if (outcome.wrote) void maybePurgeStatEvents();
  return new NextResponse(null, { status: outcome.status });
}
