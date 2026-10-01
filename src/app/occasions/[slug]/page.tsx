import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiasporaOrdersTag } from "@/components/badges";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, btnSecondary, cardClass } from "@/components/ui";
import { continueHref } from "@/lib/utils";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

async function loadOccasion(slug: string) {
  await ensureOccasionDefinitions(prisma);
  return prisma.occasion.findUnique({
    where: { slug },
    include: {
      shops: {
        where: { storefront: { published: true } },
        orderBy: [{ pinned: "desc" }, { pinOrder: "asc" }, { createdAt: "asc" }],
        include: {
          storefront: {
            select: {
              slug: true,
              servesDiaspora: true,
              user: { select: { name: true, city: true } },
            },
          },
        },
      },
      listings: {
        where: { listing: { hidden: false } },
        orderBy: [{ pinned: "desc" }, { pinOrder: "asc" }, { createdAt: "asc" }],
        select: { listingId: true, pinned: true },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await loadOccasion(slug);
  if (!occasion) return { title: "Occasion" };
  const description = occasion.intro.slice(0, 160);
  const path = `/occasions/${occasion.slug}`;
  return {
    title: occasion.title,
    description,
    alternates: { canonical: path },
    openGraph: { title: occasion.title, description, url: path },
  };
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
                    <h3 className="mt-3 font-serif text-2xl text-navy">{row.storefront.user.name}</h3>
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
