import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiasporaOrdersTag } from "@/components/badges";
import { VideoMark } from "@/components/video-mark";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, btnSecondary, cardClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { isProActive } from "@/lib/pro";
import { continueHref } from "@/lib/utils";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { publicOrigin } from "@/lib/payments/origin";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { buildShareMetadata, clipText, privateMetadata } from "@/lib/share-metadata";

type Props = { params: Promise<{ slug: string }> };

async function loadOccasion(slug: string) {
  await ensureOccasionDefinitions(prisma);
  return prisma.occasion.findUnique({
    where: { slug },
    include: {
      shops: {
        where: { storefront: publicShopWhere({ published: true }) },
        orderBy: [{ pinned: "desc" }, { pinOrder: "asc" }, { createdAt: "asc" }],
        include: {
          storefront: {
            select: {
              slug: true,
              servesDiaspora: true,
              user: { select: { name: true, city: true, verifiedPro: true, verifiedProUntil: true } },
              videos: {
                where: { status: "approved", NOT: { publicPlaybackId: "" } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
      listings: {
        where: { listing: publicListingWhere({ hidden: false }) },
        orderBy: [{ pinned: "desc" }, { pinOrder: "asc" }, { createdAt: "asc" }],
        select: { listingId: true, pinned: true },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await loadOccasion(slug);
  if (!occasion) return privateMetadata("Occasion");
  const origin = await publicOrigin();
  const name = appName();
  const description = clipText(occasion.intro) || `${occasion.title} on ${name}. Chat stays on WhatsApp.`;
  return buildShareMetadata({
    origin,
    path: `/occasions/${occasion.slug}`,
    title: occasion.title,
    description,
    image: `/occasions/${encodeURIComponent(occasion.slug)}/opengraph-image`,
    imageAlt: `${occasion.title} on ${name}`,
  });
}

export default async function OccasionPage({ params }: Props) {
  const { slug } = await params;
  const occasion = await loadOccasion(slug);
  if (!occasion) notFound();

  const user = await getSessionUser();
  const shopHref = continueHref(Boolean(user), "/account/storefront");
  const listingIds = occasion.listings.map((row) => row.listingId);
  const pinnedListings = new Set(occasion.listings.filter((row) => row.pinned).map((row) => row.listingId));
  const rows = listingIds.length ? await searchListings({ viewerId: user?.id, ids: listingIds }) : [];
  const byId = new Map(rows.map((listing) => [listing.id, listing]));
  const listings = listingIds.flatMap((id) => {
    const listing = byId.get(id);
    return listing ? [listing] : [];
  });

  const empty = occasion.shops.length === 0 && listings.length === 0;

  return (
    <article className="mx-auto grid max-w-5xl gap-8 px-4 py-8 pb-24 sm:pb-10">
      <div>
        <p className="text-sm font-semibold text-lake-dark">
          <Link href="/occasions" className="hover:text-lake">
            Occasions
          </Link>
        </p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">{occasion.title}</h1>
        <p className="mt-3 max-w-2xl whitespace-pre-wrap leading-relaxed text-ink/80">{occasion.intro}</p>
      </div>

      {empty ? (
        <EmptyState
          title="Coming soon"
          body="No shop is listed for this occasion yet. If you cook, sew, drive, host, or build for it, open your shop and tick this occasion."
          action={
            <Link href={shopHref} className={btnSecondary}>
              List your shop for this occasion
            </Link>
          }
        />
      ) : (
        <>
          {occasion.shops.length > 0 ? (
            <section className="grid gap-4">
              <h2 className="font-serif text-2xl text-navy">Shops</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {occasion.shops.map((row) => (
                  <Link key={row.id} href={`/b/${row.storefront.slug}`} className={`card-lift ${cardClass} p-5`}>
                    <div className="flex flex-wrap gap-1.5">
                      {row.pinned ? (
                        <span className="inline-flex items-center rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">
                          Pinned
                        </span>
                      ) : null}
                      {row.storefront.servesDiaspora ? <DiasporaOrdersTag /> : null}
                    </div>
                    <h3 className="mt-3 flex flex-wrap items-center gap-2 font-serif text-2xl text-navy">
                      {row.storefront.user.name}
                      {isProActive(row.storefront.user) && row.storefront.videos.length > 0 ? <VideoMark /> : null}
                    </h3>
                    <p className="mt-1 text-sm text-ink/60">{row.storefront.user.city}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {listings.length > 0 ? (
            <section className="grid gap-4">
              <h2 className="font-serif text-2xl text-navy">Listings</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {listings.map((listing) => (
                  <div key={listing.id} className="grid gap-2">
                    {pinnedListings.has(listing.id) ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy">Pinned</p>
                    ) : null}
                    <ListingCard listing={listing} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}
