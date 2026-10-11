import Link from "next/link";
import { CategoryOptions } from "@/components/category-options";
import { Pager } from "@/components/pager";
import { ShopCard } from "@/components/shop-card";
import { EmptyState, btnPrimary, btnSecondary, cardClass, chipActiveClass, chipClass, fieldClass, sectionTitleClass } from "@/components/ui";
import { activeBrowseRegion, browseRegionChipHref } from "@/lib/browse-filters";
import type { ShopCardData } from "@/lib/search";

function chipHref(base: Record<string, string>, key: string, value: string) {
  const next = { ...base };
  if (!value || next[key] === value) delete next[key];
  else next[key] = value;
  const params = new URLSearchParams();
  for (const [name, item] of Object.entries(next)) {
    if (item) params.set(name, item);
  }
  const qs = params.toString();
  return qs ? `/shops?${qs}` : "/shops";
}

function pageHref(base: Record<string, string>, page: number) {
  const params = new URLSearchParams();
  for (const [name, item] of Object.entries(base)) {
    if (item) params.set(name, item);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/shops?${qs}` : "/shops";
}

export function ShopsDirectory({
  shops,
  query,
  category,
  region,
  city,
  verified,
  page,
  pageCount,
  total,
}: {
  shops: ShopCardData[];
  query: string;
  category: string;
  region: string;
  city: string;
  verified: boolean;
  page: number;
  pageCount: number;
  total: number;
}) {
  const chipBase: Record<string, string> = {
    q: query,
    category,
    region,
    city,
    verified: verified ? "1" : "",
  };
  const activeRegion = activeBrowseRegion(city, region);
  const hasFilters = Boolean(query || category || region || city || verified);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 pb-24 sm:pb-10">
      <div>
        <h1 className={sectionTitleClass}>Shops</h1>
        <p className="mt-1 text-sm text-ink/65">Published shops. Search, category, region, and verified combine.</p>
      </div>

      <form id="shops-search" action="/shops" method="get" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="shop-q">
          Search shops
        </label>
        <input
          id="shop-q"
          name="q"
          defaultValue={query}
          placeholder="Try catering"
          className={`${fieldClass} mt-0`}
        />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {activeRegion ? <input type="hidden" name="region" value={activeRegion} /> : null}
        {verified ? <input type="hidden" name="verified" value="1" /> : null}
        <button className={`${btnPrimary} shrink-0`}>Search</button>
      </form>
      {query ? <p className="text-sm text-ink/70">Showing shops for “{query}”.</p> : null}

      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Quick filters</p>
        <div className="chip-scroll">
          <Link
            href={browseRegionChipHref(chipBase, "homeland", "/shops")}
            className={activeRegion === "homeland" ? chipActiveClass : chipClass}
          >
            Homeland
          </Link>
          <Link
            href={browseRegionChipHref(chipBase, "diaspora", "/shops")}
            className={activeRegion === "diaspora" ? chipActiveClass : chipClass}
          >
            Diaspora
          </Link>
          <Link href={chipHref(chipBase, "verified", "1")} className={verified ? chipActiveClass : chipClass}>
            Verified
          </Link>
          {hasFilters ? (
            <Link href="/shops" className={`${chipClass} border-dashed`}>
              Clear all
            </Link>
          ) : null}
        </div>
      </div>

      <form action="/shops" method="get" className={`${cardClass} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3`}>
        <label className="block text-sm font-medium text-ink/80">
          Words
          <input name="q" defaultValue={query} className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-ink/80">
          Homeland or Diaspora
          <select name="region" defaultValue={activeRegion} className={fieldClass}>
            <option value="">Any</option>
            <option value="homeland">Homeland</option>
            <option value="diaspora">Diaspora</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-ink/80">
          Category
          <select name="category" defaultValue={category} className={fieldClass}>
            <CategoryOptions blank="Any" />
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-ink/80">
          <input type="checkbox" name="verified" value="1" defaultChecked={verified} className="size-4 rounded border-sand" />
          Verified shops
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <button className={btnPrimary}>Apply filters</button>
          <Link href="/shops" className={btnSecondary}>
            Clear
          </Link>
        </div>
      </form>

      <p className="text-sm text-ink/60">
        {total === 0 ? "0 shops" : total === 1 ? "1 shop" : `${total} shops`}
      </p>
      {shops.length === 0 ? (
        <EmptyState
          title="No shops match"
          body="Try another word, or clear a filter. Draft shops stay off this page."
          action={
            <Link href="/shops" className={btnSecondary}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
      <Pager page={page} pageCount={pageCount} hrefFor={(next) => pageHref(chipBase, next)} />
    </div>
  );
}
