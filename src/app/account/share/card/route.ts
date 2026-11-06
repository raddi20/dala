import { NextResponse } from "next/server";
import { defaultSiteUrl } from "@/lib/brand";
import { formatOfferingPrice } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { shareCardPng } from "@/lib/seller-share/card";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "shop";
  const id = url.searchParams.get("id") ?? "";
  const origin = (await publicOrigin()) || defaultSiteUrl();

  let name = user.name;
  let targetUrl = `${origin.replace(/\/$/, "")}`;
  let subtitle = user.city;
  let photoUrl = "";

  if (kind === "listing" && id) {
    const listing = await prisma.listing.findFirst({
      where: { id, ownerId: user.id },
      select: { title: true, city: true, priceLabel: true, photoUrl: true, id: true },
    });
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    name = listing.title;
    targetUrl = `${origin.replace(/\/$/, "")}/listings/${listing.id}`;
    subtitle = [listing.city, listing.priceLabel].filter(Boolean).join(" · ");
    photoUrl = listing.photoUrl;
  } else {
    const shop = await prisma.storefront.findUnique({
      where: { userId: user.id },
      select: { slug: true, bannerUrl: true, id: true },
    });
    if (!shop) return NextResponse.json({ error: "No shop" }, { status: 404 });
    if (id && id !== shop.id) {
      const offering = await prisma.offering.findFirst({
        where: { id, storefrontId: shop.id, archived: false },
        select: { title: true, description: true, imageUrl: true, priceCents: true, currency: true },
      });
      if (offering) {
        name = offering.title;
        targetUrl = `${origin.replace(/\/$/, "")}/b/${shop.slug}`;
        subtitle = formatOfferingPrice(offering.priceCents, offering.currency);
        photoUrl = offering.imageUrl || shop.bannerUrl;
      } else {
        targetUrl = `${origin.replace(/\/$/, "")}/b/${shop.slug}`;
        photoUrl = shop.bannerUrl;
      }
    } else {
      targetUrl = `${origin.replace(/\/$/, "")}/b/${shop.slug}`;
      photoUrl = shop.bannerUrl;
    }
  }

  const png = await shareCardPng({ name, url: targetUrl, subtitle, photoUrl });
  const safe = name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "rangach";
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="rangach-${safe}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
