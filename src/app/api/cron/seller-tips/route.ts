import { NextResponse } from "next/server";
import { runWeeklySellerTips } from "@/lib/ai/seller-tips";
import { cronAuthorized } from "@/lib/ai/zeptomail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function handleSellerTipsCron(
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
  return handleSellerTipsCron(request);
}

export function POST(request: Request) {
  return handleSellerTipsCron(request);
}
