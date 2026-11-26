import { digestUnsubscribeToken } from "@/lib/community/unsubscribe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const secret = process.env.CRON_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || "";
  if (!userId || !secret || token !== digestUnsubscribeToken(userId, secret)) {
    return new Response("This unsubscribe link is not valid.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  try {
    await prisma.user.update({ where: { id: userId }, data: { followDigestOptOut: true } });
  } catch {
    return new Response("Could not update that preference.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response("You will not get the Monday note about shops you follow. Following the shops is unchanged.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
