import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { ListingCard } from "@/components/listing-card";
import { btnPrimary, btnSecondary, cardClass, sectionTitleClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { publicOrigin } from "@/lib/payments/origin";
import { ListingLinkList } from "@/components/listing-link-list";
import { Pager } from "@/components/pager";
import { hubDescription, hubIntro } from "@/lib/crawl-copy";
import { townHubFacts, townListingPage, townShopPage } from "@/lib/crawl-data";
import { crawlPage, crawlPageHref, hubIndexable, hubRobots } from "@/lib/crawl-index";
import { searchListings } from "@/lib/search";
import {
  cityBrowseHref,
  cityPageJsonLd,
  cityPagePath,
  cityTitle,
  townPage,
} from "@/lib/seo";
import { townPagesWithContent } from "@/lib/town-pages";
import { getSessionUser } from "@/lib/session";
import { buildShareMetadata } from "@/lib/share-metadata";
import { continueHref, one } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
  searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const page = townPage((await params).slug);
  if (!page) return { title: "Not found" };
  const query = await searchParams;
  const name = appName();
  const facts = await townHubFacts(page.city);
  const meta = buildShareMetadata({
    origin: await publicOrigin(),
    path: cityPagePath(page),
    title: cityTitle(page),
    description: hubDescription({
      placeName: page.city,
      siteName: name,
      shopCount: facts.shops,
      listingCount: facts.listings,
      sampleTitles: facts.samples.map((item) => item.title),
    }),
    image: "/listings/opengraph-image",
    imageAlt: `${cityTitle(page)} on ${name}`,
  });
  // A town with nothing in it is a thin page. Keep it reachable, out of the index.
  if (!hubIndexable(facts.shops, facts.listings)) {
    return { ...meta, robots: hubRobots(facts.shops, facts.listings) };
  }
  // Later pages of the same town are followable duplicates of this URL.
  const paged = one(query.shops).trim() !== "" || one(query.listings).trim() !== "";
  return paged ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function CityPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = townPage(slug);
  if (!page) notFound();
  const name = appName();
  const [origin, user, facts, listingWindow, shopWindow, towns] = await Promise.all([
    publicOrigin(),
    getSessionUser(),
    townHubFacts(page.city),
    townListingPage(page.city, crawlPage(one(query.listings))),
    townShopPage(page.city, crawlPage(one(query.shops))),
    townPagesWithContent(),
  ]);
  const listings = (await searchListings({ city: page.city, viewerId: user?.id })).slice(0, 8);
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
      <p className="mt-2 max-w-2xl text-ink/80">
        {hubIntro({ placeName: page.city, siteName: name, shopCount: facts.shops, listingCount: facts.listings })}
      </p>
      {facts.samples.length ? (
        <p className="mt-2 max-w-2xl text-sm text-ink/70">
          Listings include{" "}
          {facts.samples.map((item, index) => (
            <span key={item.id}>
              {index > 0 ? ", " : null}
              <Link href={`/listings/${encodeURIComponent(item.id)}`} className="font-semibold text-gold-d">
                {item.title}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={browseHref} className={btnPrimary}>
          Browse all in {page.city}
        </Link>
        <Link href={`/shops?city=${encodeURIComponent(page.city)}`} className={btnSecondary}>
          Shops in {page.city}
        </Link>
      </div>

      {shopWindow.total ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl text-navy">Shops in {page.city}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {shopWindow.shops.map((shop) => (
              <li key={shop.slug}>
                <Link href={`/b/${encodeURIComponent(shop.slug)}`} className="underline underline-offset-2">
                  {shop.user.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Pager page={shopWindow.page} pageCount={shopWindow.pageCount} hrefFor={(next) => crawlPageHref(cityPagePath(page), "shops", next)} />
          </div>
        </section>
      ) : null}

      {listingWindow.total ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl text-navy">All listings in {page.city}</h2>
          <div className="mt-3">
            <ListingLinkList listings={listingWindow.listings} />
          </div>
          <div className="mt-3">
            <Pager
              page={listingWindow.page}
              pageCount={listingWindow.pageCount}
              hrefFor={(next) => crawlPageHref(cityPagePath(page), "listings", next)}
            />
          </div>
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
