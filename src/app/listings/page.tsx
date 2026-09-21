import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { btnPrimary, btnSecondary, fieldClass } from "@/components/ui";
import { CATEGORIES, CITIES, LISTING_TYPES } from "@/lib/constants";
import { parseNlQuery } from "@/lib/nl-query";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Browse" };

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nlRaw = one(sp.nl).trim();
  const parsed = nlRaw ? parseNlQuery(nlRaw) : null;
  const filters = {
    q: one(sp.q) || parsed?.q || "",
    city: one(sp.city) || parsed?.city || "",
    region: one(sp.region) || parsed?.region || "",
    category: one(sp.category) || parsed?.category || "",
    type: one(sp.type) || parsed?.type || "",
    verified: one(sp.verified) === "1" || parsed?.verified === true,
  };
  const user = await getSessionUser();
  const listings = await searchListings({ ...filters, viewerId: user?.id });

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Browse</h1>
        <p className="mt-1 text-sm text-ink/70">Directory and classifieds. Filters combine.</p>
      </div>

      <form action="/listings" method="get" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="nl">
          Search in a sentence
        </label>
        <input id="nl" name="nl" defaultValue={nlRaw} placeholder="housing in London" className={fieldClass} />
        <button className={btnPrimary}>Read search</button>
      </form>
      {parsed ? (
        <p className="rounded-lg bg-sand/60 px-3 py-2 text-sm">
          Read as: {parsed.summary}.{" "}
          <Link href="/listings" className="font-semibold text-lake-dark">
            Clear
          </Link>
        </p>
      ) : null}

      <form action="/listings" method="get" className="grid gap-3 rounded-2xl border border-sand bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          Words
          <input name="q" defaultValue={filters.q} className={fieldClass} />
        </label>
        <label className="block text-sm">
          City
          <select name="city" defaultValue={filters.city} className={fieldClass}>
            <option value="">Any</option>
            {CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Homeland or diaspora
          <select name="region" defaultValue={filters.region} className={fieldClass}>
            <option value="">Any</option>
            <option value="homeland">Homeland</option>
            <option value="diaspora">Diaspora</option>
          </select>
        </label>
        <label className="block text-sm">
          Category
          <select name="category" defaultValue={filters.category} className={fieldClass}>
            <option value="">Any</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Type
          <select name="type" defaultValue={filters.type} className={fieldClass}>
            <option value="">Any</option>
            <option value="classifieds">All classifieds</option>
            {LISTING_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="verified" value="1" defaultChecked={filters.verified} />
          Verified only
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <button className={btnPrimary}>Apply filters</button>
          <Link href="/listings" className={btnSecondary}>
            Clear
          </Link>
        </div>
      </form>

      <p className="text-sm text-ink/70">
        {listings.length} listing{listings.length === 1 ? "" : "s"}
      </p>
      {listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand bg-card p-6 text-sm">
          Nothing matches. Try clearing a filter.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
