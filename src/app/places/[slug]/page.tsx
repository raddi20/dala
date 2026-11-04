import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { ListingCard } from "@/components/listing-card";
import { btnPrimary, btnSecondary, cardClass, sectionTitleClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { publicOrigin } from "@/lib/payments/origin";
import { publicListingWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/search";
import {
  cityBrowseHref,
  cityDescription,
  cityPageJsonLd,
  cityPagePath,
  cityTitle,
  townPage,
} from "@/lib/seo";
import { shopsInTown, townPagesWithContent } from "@/lib/town-pages";
import { getSessionUser } from "@/lib/session";
import { buildShareMetadata } from "@/lib/share-metadata";
import { continueHref } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = townPage((await params).slug);
  if (!page) return { title: "Not found" };
  const name = appName();
  const [listingCount, shops] = await Promise.all([
    prisma.listing.count({ where: publicListingWhere({ city: page.city }) }),
    shopsInTown(page.city, 1),
  ]);
  const meta = buildShareMetadata({
    origin: await publicOrigin(),
    path: cityPagePath(page),
    title: cityTitle(page),
    description: cityDescription(page, name),
    image: "/listings/opengraph-image",
    imageAlt: `${cityTitle(page)} on ${name}`,
  });
  // A town with nothing in it is a thin page. Keep it reachable, out of the index.
  return listingCount || shops.length ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function CityPage({ params }: Params) {
  const page = townPage((await params).slug);
  if (!page) notFound();
  const name = appName();
  const [origin, user] = await Promise.all([publicOrigin(), getSessionUser()]);
  const [allListings, shops, towns] = await Promise.all([
    searchListings({ city: page.city, viewerId: user?.id }),
    shopsInTown(page.city),
    townPagesWithContent(),
  ]);
  const listings = allListings.slice(0, 8);
  const browseHref = cityBrowseHref(page);
  const listHref = continueHref(Boolean(user), "/listings/new");
  const others = towns.filter((item) => item.slug !== page.slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd data={cityPageJsonLd(origin, name, page, listings.map((item) => ({ id: item.id, title: item.title })))} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink/60">
        <Link href="/" className="underline-offset-2 hover:underline">
          {name}
        </Link>{" "}
        / {page.city}
      </nav>
      <h1 className={`${sectionTitleClass} mt-2`}>{cityTitle(page)}</h1>
      <p className="mt-2 max-w-2xl text-ink/80">{page.intro}</p>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        People come here looking for {page.examples.join(", ")}. Discovery happens on {name}; you chat with the seller on WhatsApp.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={browseHref} className={btnPrimary}>
          Browse all in {page.city}
        </Link>
        <Link href={`/shops?city=${encodeURIComponent(page.city)}`} className={btnSecondary}>
          Shops in {page.city}
        </Link>
      </div>

      {shops.length ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl text-navy">Shops in {page.city}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {shops.map((shop) => (
              <li key={shop.slug}>
                <Link href={`/b/${encodeURIComponent(shop.slug)}`} className="underline underline-offset-2">
                  {shop.user.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-serif text-xl text-navy">Recent listings in {page.city}</h2>
        {listings.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {listings.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} priority={index < 2} />
            ))}
          </div>
        ) : (
          <div className={`${cardClass} mt-3 border-dashed px-6 py-8 text-center`}>
            <p className="text-ink/80">No listings in {page.city} yet.</p>
            <p className="mt-1 text-sm text-ink/60">Run a business in {page.city}? Listing it is free.</p>
            <Link href={listHref} className={`${btnPrimary} mt-4 inline-flex`}>
              List your business
            </Link>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl text-navy">Other towns</h2>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm">
          {others.map((item) => (
            <li key={item.slug}>
              <Link href={cityPagePath(item)} className="underline underline-offset-2">
                {item.city}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/listings?region=homeland" className="underline underline-offset-2">
              All of Kenya
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
