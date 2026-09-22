import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { btnNavy, btnPrimary, btnSecondary, cardClass, fieldClass, sectionTitleClass } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { continueHref, isFeatured } from "@/lib/utils";

/** Local SVG: warm geometric shops + connection nodes (navy/amber/cream). Replaces Unsplash food plate. */
const HERO_IMAGE = "/hero-community.svg";

export default async function HomePage() {
  const user = await getSessionUser();
  const shop = user
    ? await prisma.storefront.findUnique({ where: { userId: user.id }, select: { id: true } })
    : null;
  const shopHref = continueHref(Boolean(user), "/account/storefront");
  const listHref = continueHref(Boolean(user), "/listings/new");
  const sellerHint = !user
    ? "Sign in first. We continue to shop setup or the listing form."
    : shop
      ? "Your shop is in the header. List another business in the directory any time."
      : "Open a shop, add one offering, then publish. Buyers message you on WhatsApp.";
  const listings = await searchListings({ viewerId: user?.id });
  const featured = listings.filter((listing) => isFeatured(listing)).slice(0, 4);
  const classifieds = listings.filter((listing) => listing.type !== "business").slice(0, 4);

  return (
    <div>
      <section className="hero-banner relative isolate min-h-[min(88vh,760px)] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt=""
          className="hero-visual absolute inset-0 h-full w-full object-cover object-right"
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <span className="hero-orb hero-orb-a" />
          <span className="hero-orb hero-orb-b" />
        </div>
        {/* Left-weighted overlays keep copy readable while shop geometry stays visible on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/55 to-navy/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/55 via-transparent to-navy/15" />

        <div className="relative mx-auto flex min-h-[min(88vh,760px)] max-w-5xl flex-col justify-end px-4 pb-12 pt-20 sm:justify-center sm:pb-16 sm:pt-24">
          <p className="hero-brand font-serif text-5xl leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
            {APP_NAME}
          </p>
          <h1 className="hero-copy mt-4 max-w-xl text-xl font-medium leading-snug text-white/95 sm:text-2xl">
            Browse trusted Luo shops and classifieds — then chat on WhatsApp.
          </h1>
          <p className="hero-copy mt-3 max-w-lg text-base text-white/75 sm:text-lg" style={{ animationDelay: "80ms" }}>
            {APP_TAGLINE}
          </p>

          <form
            action="/listings"
            method="get"
            className="hero-copy mt-8 flex w-full max-w-xl flex-col gap-2 sm:flex-row"
            style={{ animationDelay: "140ms" }}
          >
            <label className="sr-only" htmlFor="home-nl">
              Search in a sentence
            </label>
            <input
              id="home-nl"
              name="nl"
              placeholder="Try: verified electricians in Nairobi"
              className={`${fieldClass} mt-0 border-0 bg-white/95 shadow-lg`}
            />
            <button className={`${btnPrimary} shrink-0 shadow-lg sm:px-6`}>Search</button>
          </form>

          <div className="hero-copy mt-4 flex w-full max-w-xl flex-col gap-2 sm:flex-row" style={{ animationDelay: "200ms" }}>
            <Link href={shopHref} className={`${btnPrimary} shadow-lg`}>
              Open a shop
            </Link>
            <Link href={listHref} className={`${btnSecondary} shadow-lg`}>
              List your business
            </Link>
          </div>
          <p className="hero-copy mt-3 max-w-lg text-sm text-white/75" style={{ animationDelay: "240ms" }}>
            {sellerHint}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 pb-28 sm:gap-14 sm:py-16 md:pb-16">
        <section>
          <h2 className={sectionTitleClass}>Where to start</h2>
          <p className="mt-2 max-w-xl text-ink/65">
            Browse the directory, or open a shop in three steps: create it from your profile, add an offering, then publish.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={shopHref} className={btnPrimary}>
              Open a shop
            </Link>
            <Link href={listHref} className={btnNavy}>
              List your business
            </Link>
            <Link href="/listings" className={btnSecondary}>
              Browse
            </Link>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass}>Cities</h2>
          <p className="mt-2 text-ink/65">Homeland and diaspora — same community directory.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {CITIES.map((city) => (
              <Link
                key={city.name}
                href={`/listings?city=${city.name}&region=${city.region}`}
                className={`card-lift group relative overflow-hidden ${cardClass} p-6`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-lake">
                  {city.region === "homeland" ? "Homeland" : "Diaspora"} · {city.country}
                </p>
                <h3 className="mt-2 font-serif text-3xl text-navy transition-colors group-hover:text-lake-dark">
                  {city.name}
                </h3>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass}>Categories</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/listings?category=${encodeURIComponent(category)}`}
                className="rounded-full border border-sand bg-card px-3.5 py-2 text-sm font-medium text-ink/80 shadow-sm transition-colors hover:border-navy/20 hover:bg-white hover:text-navy"
              >
                {category}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className={sectionTitleClass}>Featured</h2>
              <p className="mt-1 text-sm text-ink/60">Raised shops and listings worth a look first.</p>
            </div>
            <Link href="/listings" className="shrink-0 text-sm font-semibold text-lake-dark hover:text-lake">
              Browse all
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className={sectionTitleClass}>Recent classifieds</h2>
              <p className="mt-1 text-sm text-ink/60">Housing, goods, and services from the community.</p>
            </div>
            <Link
              href="/listings?type=classifieds"
              className="shrink-0 text-sm font-semibold text-lake-dark hover:text-lake"
            >
              All classifieds
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {classifieds.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand/80 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgb(20_26_36/0.08)] backdrop-blur md:hidden sticky-cta-bar">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Link href={shopHref} className={`${btnPrimary} flex-1`}>
            Open a shop
          </Link>
          <Link href={listHref} className={`${btnSecondary} flex-1`}>
            List business
          </Link>
        </div>
      </div>
    </div>
  );
}
