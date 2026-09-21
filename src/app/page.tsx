import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { btnPrimary, fieldClass } from "@/components/ui";
import { APP_MEANING, APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { CATEGORIES, CITIES } from "@/lib/constants";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { isFeatured } from "@/lib/utils";

export default async function HomePage() {
  const user = await getSessionUser();
  const listings = await searchListings({ viewerId: user?.id });
  const featured = listings.filter((listing) => isFeatured(listing)).slice(0, 4);
  const classifieds = listings.filter((listing) => listing.type !== "business").slice(0, 4);

  return (
    <div>
      <section className="border-b border-sand bg-card">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-lake">{APP_MEANING}</p>
          <h1 className="mt-2 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
            {APP_NAME} lists Luo businesses and services.
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink/80">{APP_TAGLINE} Chat stays on WhatsApp.</p>
          <form action="/listings" method="get" className="mt-6 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="home-nl">
              Search in a sentence
            </label>
            <input
              id="home-nl"
              name="nl"
              placeholder="Try: verified restaurants in Nairobi"
              className={fieldClass}
            />
            <button className={btnPrimary}>Search</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/listings?city=Nairobi&type=business" className="rounded-full bg-sand px-3 py-1 hover:bg-sand/70">
              Nairobi directory
            </Link>
            <Link href="/listings?city=London&region=diaspora" className="rounded-full bg-sand px-3 py-1 hover:bg-sand/70">
              London diaspora
            </Link>
            <Link href="/listings?type=classifieds" className="rounded-full bg-sand px-3 py-1 hover:bg-sand/70">
              Classifieds
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10">
        <section className="grid gap-3 sm:grid-cols-2">
          {CITIES.map((city) => (
            <Link
              key={city.name}
              href={`/listings?city=${city.name}&region=${city.region}`}
              className="rounded-2xl border border-sand bg-card p-5"
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-lake">
                {city.region === "homeland" ? "Homeland" : "Diaspora"} · {city.country}
              </p>
              <h2 className="mt-1 font-serif text-3xl">{city.name}</h2>
            </Link>
          ))}
        </section>

        <section>
          <h2 className="font-serif text-2xl">Categories</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/listings?category=${encodeURIComponent(category)}`}
                className="rounded-xl border border-sand bg-card px-3 py-3 text-sm hover:border-lake"
              >
                {category}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl">Featured</h2>
            <Link href="/listings" className="text-sm font-semibold text-lake-dark">
              Browse all
            </Link>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl">Recent classifieds</h2>
            <Link href="/listings?type=classifieds" className="text-sm font-semibold text-lake-dark">
              All classifieds
            </Link>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {classifieds.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
