import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import {
  EmptyState,
  btnPrimary,
  btnSecondary,
  cardClass,
  chipActiveClass,
  chipClass,
  fieldClass,
  sectionTitleClass,
} from "@/components/ui";
import { CATEGORIES, CITIES, LISTING_TYPES } from "@/lib/constants";
import { parseNlQuery } from "@/lib/nl-query";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Browse" };

function chipHref(base: Record<string, string>, key: string, value: string) {
  const next = { ...base };
  if (!value || next[key] === value) delete next[key];
  else next[key] = value;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/listings?${qs}` : "/listings";
}

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
  const chipBase: Record<string, string> = {
    q: filters.q,
    city: filters.city,
    region: filters.region,
    category: filters.category,
    type: filters.type,
    verified: filters.verified ? "1" : "",
  };
  const user = await getSessionUser();
  const listings = await searchListings({ ...filters, viewerId: user?.id });
  const hasFilters = Boolean(
    filters.q || filters.city || filters.region || filters.category || filters.type || filters.verified || nlRaw,
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 pb-24 sm:pb-10">
      <div>
        <h1 className={sectionTitleClass}>Browse</h1>
        <p className="mt-1 text-sm text-ink/65">Directory and classifieds. Filters combine.</p>
      </div>

      <form id="search" action="/listings" method="get" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="nl">
          Search in a sentence
        </label>
        <input
          id="nl"
          name="nl"
          defaultValue={nlRaw}
          placeholder="housing in London"
          className={`${fieldClass} mt-0`}
        />
        <button className={`${btnPrimary} shrink-0`}>Search</button>
      </form>
      {parsed ? (
        <p className="rounded-xl bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark">
          Read as: {parsed.summary}.{" "}
          <Link href="/listings" className="font-semibold underline-offset-2 hover:underline">
            Clear
          </Link>
        </p>
      ) : null}

      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Quick filters</p>
        <div className="chip-scroll">
          <Link href={chipHref(chipBase, "city", "Nairobi")} className={filters.city === "Nairobi" ? chipActiveClass : chipClass}>
            Nairobi
          </Link>
          <Link href={chipHref(chipBase, "city", "London")} className={filters.city === "London" ? chipActiveClass : chipClass}>
            London
          </Link>
          <Link
            href={chipHref(chipBase, "region", "homeland")}
            className={filters.region === "homeland" ? chipActiveClass : chipClass}
          >
            Homeland
          </Link>
          <Link
            href={chipHref(chipBase, "region", "diaspora")}
            className={filters.region === "diaspora" ? chipActiveClass : chipClass}
          >
            Diaspora
          </Link>
          <Link
            href={chipHref(chipBase, "type", "business")}
            className={filters.type === "business" ? chipActiveClass : chipClass}
          >
            Businesses
          </Link>
          <Link
            href={chipHref(chipBase, "type", "classifieds")}
            className={filters.type === "classifieds" ? chipActiveClass : chipClass}
          >
            Classifieds
          </Link>
          <Link
            href={chipHref(chipBase, "verified", "1")}
            className={filters.verified ? chipActiveClass : chipClass}
          >
            Verified only
          </Link>
          {hasFilters ? (
            <Link href="/listings" className={`${chipClass} border-dashed`}>
              Clear all
            </Link>
          ) : null}
        </div>
      </div>

      <details className={`${cardClass} group`}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            More filters
            <span className="text-ink/40 transition group-open:rotate-180">▾</span>
          </span>
        </summary>
        <form action="/listings" method="get" className="grid gap-3 border-t border-sand/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-medium text-ink/80">
            Words
            <input name="q" defaultValue={filters.q} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-ink/80">
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
          <label className="block text-sm font-medium text-ink/80">
            Homeland or diaspora
            <select name="region" defaultValue={filters.region} className={fieldClass}>
              <option value="">Any</option>
              <option value="homeland">Homeland</option>
              <option value="diaspora">Diaspora</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-ink/80">
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
          <label className="block text-sm font-medium text-ink/80">
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
          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-ink/80">
            <input type="checkbox" name="verified" value="1" defaultChecked={filters.verified} className="size-4 rounded border-sand" />
            Verified only
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <button className={btnPrimary}>Apply filters</button>
            <Link href="/listings" className={btnSecondary}>
              Clear
            </Link>
          </div>
        </form>
      </details>

      <p className="text-sm text-ink/60">
        {listings.length} listing{listings.length === 1 ? "" : "s"}
      </p>
      {listings.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try clearing a filter or searching with different words."
          action={
            <Link href="/listings" className={btnSecondary}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand/80 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgb(20_26_36/0.08)] backdrop-blur md:hidden sticky-cta-bar">
        <a href="#search" className={`${btnPrimary} w-full`}>
          Search listings
        </a>
      </div>
    </div>
  );
}
