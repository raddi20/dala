import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { applyFollow, FOLLOW_LIMIT, FOLLOW_WINDOW_MS } from "@/lib/community/follow";
import { prismaFollowStore } from "@/lib/community/follow-db";
import { prisma } from "@/lib/prisma";
import { consumeFixedWindow } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import { safePath } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign-in returns here so the follow is applied, then sends the person to the shop. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopId = (url.searchParams.get("shop") ?? "").trim();
  const next = safePath(url.searchParams.get("next") ?? "/", "/");
  const user = await getSessionUser();
  if (!user) {
    const again = `/api/community/follow?shop=${encodeURIComponent(shopId)}&next=${encodeURIComponent(next)}`;
    redirect(`/login?next=${encodeURIComponent(again)}`);
  }
  const gate = await consumeFixedWindow({
    action: "shop-follow",
    subject: user.id,
    limit: FOLLOW_LIMIT,
    windowMs: FOLLOW_WINDOW_MS,
  });
  const result = await applyFollow(prismaFollowStore(), {
    userId: user.id,
    userEmail: user.email,
    shopId,
    limited: gate.limited,
    intent: "follow",
  });
  const shop = shopId
    ? await prisma.storefront.findUnique({ where: { id: shopId }, select: { slug: true } })
    : null;
  if (!result.ok) {
    const dest = shop ? `/b/${shop.slug}` : next;
    const join = dest.includes("?") ? "&" : "?";
    redirect(`${dest}${join}follow=${result.code}`);
  }
  redirect(shop ? `/b/${shop.slug}` : next);
}

export function POST() {
  return NextResponse.json({ error: "Use the follow button." }, { status: 405 });
}
