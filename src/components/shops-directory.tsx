import Link from "next/link";
import { Pager } from "@/components/pager";
import { ShopCard } from "@/components/shop-card";
import {
  FilterSheet,
  ResultsSearchBar,
  ShopFilterForm,
  UnderstoodRow,
} from "@/components/results-chrome";
import { EmptyState, btnSecondary, chipActiveClass, chipClass } from "@/components/ui";
import { activeBrowseRegion, browseRegionChipHref } from "@/lib/browse-filters";
import type { ShopCardData } from "@/lib/search";
import { browseHref, chipBag, toggleFilterHref, type UnderstoodChip } from "@/lib/understood-chips";

function pageHref(base: Record<string, string>, page: number) {
  return browseHref("/shops", base, page);
}

export function ShopsDirectory({
  shops,
  query,
  category,
  region,
  city,
  verified,
  diaspora = false,
  occasion = "",
  nl = "",
  page,
  pageCount,
  total,
  understood = null,
}: {
  shops: ShopCardData[];
  query: string;
  category: string;
  region: string;
  city: string;
  verified: boolean;
  diaspora?: boolean;
  occasion?: string;
  nl?: string;
  page: number;
  pageCount: number;
  total: number;
  understood?: {
    chips: UnderstoodChip[];
    spark: boolean;
    assist: "rules" | "smart" | "fallback";
    droppedWords: boolean;
  } | null;
}) {
  const filters = chipBag({
    q: query,
    nl,
    category,
    region,
    city,
    verified,
    diaspora,
    occasion,
  });
  const activeRegion = activeBrowseRegion(city, region);
  const closeHref = browseHref("/shops", filters);
  const sheetActive = Boolean(category || diaspora || occasion);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-4">
      <h1 className="sr-only">Shops</h1>
      <ResultsSearchBar
        action="/shops"
        inputId="shop-nl"
        inputName="nl"
        defaultValue={nl || query}
        label="Search shops"
        sheet={
          <FilterSheet active={sheetActive} closeHref={closeHref}>
            <ShopFilterForm
              action="/shops"
              clearHref="/shops"
              hidden={{ nl, q: query, city, occasion }}
              region={region}
              city={city}
              category={category}
              verified={verified}
              diaspora={diaspora}
            />
          </FilterSheet>
        }
        pills={
          <>
            <Link
              href={browseRegionChipHref(filters, "homeland", "/shops")}
              className={activeRegion === "homeland" ? chipActiveClass : chipClass}
            >
              Homeland
            </Link>
            <Link
              href={browseRegionChipHref(filters, "diaspora", "/shops")}
              className={activeRegion === "diaspora" ? chipActiveClass : chipClass}
            >
              Diaspora
            </Link>
            <Link href={toggleFilterHref("/shops", filters, "verified", "1")} className={verified ? chipActiveClass : chipClass}>
              Checked
            </Link>
          </>
        }
      />

      {understood ? (
        <UnderstoodRow
          chips={understood.chips}
          spark={understood.spark}
          assist={understood.assist}
          droppedWords={understood.droppedWords}
        />
      ) : null}
      {query ? <p className="text-sm text-ink/70">Showing shops for “{query}”.</p> : null}

      <p className="text-sm text-ink/60">{total === 0 ? "0 shops" : total === 1 ? "1 shop" : `${total} shops`}</p>
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
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
      <Pager page={page} pageCount={pageCount} hrefFor={(next) => pageHref(filters, next)} />
    </div>
  );
}
