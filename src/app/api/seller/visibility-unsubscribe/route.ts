import { setVisibilityEmailOptOut } from "@/lib/seller-mail/visibility";
import { visibilityUnsubscribeToken } from "@/lib/seller-mail/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const secret = process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";
  if (!userId || !secret || token !== visibilityUnsubscribeToken(userId, secret)) {
    return new Response("This unsubscribe link is not valid.", { status: 400 });
  }
  try {
    await setVisibilityEmailOptOut(userId, true);
  } catch {
    return new Response("Could not update that preference.", { status: 500 });
  }
  return new Response("You will not get Rangach shop tip emails.", { status: 200 });
}
