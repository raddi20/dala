import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { expireShopUpdates } from "@/lib/community/expire-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await expireShopUpdates();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
}
