import { setTipsEmailOptIn, unsubscribeToken } from "@/lib/ai/seller-tips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const secret = process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";
  if (!userId || !secret || token !== unsubscribeToken(userId, secret)) {
    return new Response("This unsubscribe link is not valid.", { status: 400 });
  }
  try {
    await setTipsEmailOptIn(userId, false);
  } catch {
    return new Response("Could not update that preference.", { status: 500 });
  }
  return new Response("You will not get the weekly Rangach note by email.", { status: 200 });
}
