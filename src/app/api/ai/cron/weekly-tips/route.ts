import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { runWeeklySellerTips } from "@/lib/ai/seller-tips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function handleWeeklyTips(
  request: Request,
  deps: { env?: NodeJS.ProcessEnv; run?: typeof runWeeklySellerTips } = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!cronAuthorized(request, env)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await (deps.run ?? runWeeklySellerTips)({ env });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handleWeeklyTips(request);
}
