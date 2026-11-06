import type { Metadata } from "next";
import Link from "next/link";
import { SellerShareTool, type ShareChoice } from "@/components/seller-share-tool";
import { SellerVisibilityChecklist } from "@/components/seller-visibility-checklist";
import { cardClass, sectionTitleClass } from "@/components/ui";
import { defaultSiteUrl } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { buildVisibilityChecklist } from "@/lib/seller-share/checklist";
import { handlesFromShop, missingHandleKeys } from "@/lib/seller-share/handles";
import { whatsappShareLink } from "@/lib/whatsapp";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Share & promote", robots: { index: false, follow: false } };

export default async function AccountSharePage() {
  const user = await requireUser("/account/share");
  const origin = (await publicOrigin()) || defaultSiteUrl();
  const storefront = await prisma.storefront.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      slug: true,
      published: true,
      bannerUrl: true,
      instagramHandle: true,
      facebookHandle: true,
      xHandle: true,
      tiktokHandle: true,
      offerings: {
        where: { archived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, description: true, imageUrl: true, priceCents: true, currency: true },
        take: 30,
      },
      branches: { select: { hours: true, phone: true } },
    },
  });
  const listings = await prisma.listing.findMany({
    where: { ownerId: user.id, hidden: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, photoUrl: true, city: true, priceLabel: true },
    take: 30,
  });

  const handles = handlesFromShop({
    instagramHandle: storefront?.instagramHandle,
    facebookHandle: storefront?.facebookHandle,
    xHandle: storefront?.xHandle,
    tiktokHandle: storefront?.tiktokHandle,
    whatsapp: user.whatsapp,
    phone: user.phone,
  });
  const missing = missingHandleKeys(handles);

  const choices: ShareChoice[] = [];
  if (storefront) {
    choices.push({
      id: storefront.id,
      kind: "shop",
      label: user.name,
      url: `${origin.replace(/\/$/, "")}/b/${storefront.slug}`,
      city: user.city,
      description: user.bio,
      photoUrl: storefront.bannerUrl,
    });
  }
  for (const listing of listings) {
    choices.push({
      id: listing.id,
      kind: "listing",
      label: listing.title,
      url: `${origin.replace(/\/$/, "")}/listings/${listing.id}`,
      city: listing.city,
      description: listing.description,
      priceLabel: listing.priceLabel,
      photoUrl: listing.photoUrl,
    });
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <div>
        <h1 className={sectionTitleClass}>Share &amp; promote</h1>
        <p className="mt-2 text-sm text-ink/70">
          Ready captions and a branded card for WhatsApp, Instagram, Facebook, X, and TikTok. You post yourself — we do
          not connect to your social accounts. This kit is free with every live shop — not part of Featured or Verified
          Pro.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          <Link href="/account" className="text-lake-dark hover:text-lake">
            Account
          </Link>
          <Link href="/account/storefront" className="text-lake-dark hover:text-lake">
            Shop settings
          </Link>
        </p>
      </div>

      {missing.length > 0 ? (
        <section className={`${cardClass} grid gap-2 border-clay/30 bg-amber-soft/50 p-4`}>
          <h2 className="font-semibold text-navy">Add your social handles</h2>
          <p className="text-sm text-ink/75">
            Missing: {missing.join(", ")}. Save them in shop settings so captions can mention your own accounts. WhatsApp
            comes from your account phone number.
          </p>
          <Link href="/account/storefront#shop-settings" className="text-sm font-semibold text-lake-dark underline">
            Open shop settings
          </Link>
        </section>
      ) : null}

      {storefront?.published ? (
        <SellerVisibilityChecklist
          items={buildVisibilityChecklist({
            published: true,
            bannerUrl: storefront.bannerUrl,
            bio: user.bio,
            phone: user.phone,
            whatsapp: user.whatsapp,
            offerings: storefront.offerings.map((row) => ({ imageUrl: row.imageUrl })),
            listings: listings.map((row) => ({ photoUrl: row.photoUrl })),
            branches: storefront.branches,
            handles,
            featured: false,
            verifiedPro: user.verifiedPro,
          })}
          shopUrl={`${origin.replace(/\/$/, "")}/b/${storefront.slug}`}
          shopName={user.name}
          whatsappShareHref={whatsappShareLink(user.name, `${origin.replace(/\/$/, "")}/b/${storefront.slug}`)}
        />
      ) : null}

      {!storefront ? (
        <section className={`${cardClass} p-4 text-sm text-ink/75`}>
          Start a shop first, then come back to share it.{" "}
          <Link href="/account/storefront" className="font-semibold text-lake-dark underline">
            Open a shop
          </Link>
        </section>
      ) : !storefront.published ? (
        <section className={`${cardClass} p-4 text-sm text-ink/75`}>
          Your shop is still a draft. Publish it so the share link reaches buyers.{" "}
          <Link href="/account/storefront#published" className="font-semibold text-lake-dark underline">
            Publish
          </Link>
        </section>
      ) : null}

      <SellerShareTool choices={choices} handles={handles} cardPath="/account/share/card" />
    </div>
  );
}
