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
import type { Lang } from "@/lib/i18n/lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
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
  lang = "en",
  lite = false,
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
  lang?: Lang;
  lite?: boolean;
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
  const sheetActive = Boolean(city || category || diaspora || occasion);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-4">
      <h1 className="sr-only">{uiText(lang, "home_shops")}</h1>
      <ResultsSearchBar
        action="/shops"
        inputId="shop-nl"
        inputName="nl"
        defaultValue={nl || query}
        label={uiText(lang, "search_shops_label")}
        lang={lang}
        sheet={
          <FilterSheet active={sheetActive} closeHref={closeHref} lang={lang}>
            <ShopFilterForm
              action="/shops"
              clearHref="/shops"
              hidden={{ nl, q: query, occasion }}
              region={region}
              city={city}
              category={category}
              verified={verified}
              diaspora={diaspora}
              lang={lang}
            />
          </FilterSheet>
        }
        pills={
          <>
            <Link
              href={browseRegionChipHref(filters, "homeland", "/shops")}
              className={activeRegion === "homeland" ? chipActiveClass : chipClass}
            >
              {uiText(lang, "homeland")}
            </Link>
            <Link
              href={browseRegionChipHref(filters, "diaspora", "/shops")}
              className={activeRegion === "diaspora" ? chipActiveClass : chipClass}
            >
              {uiText(lang, "diaspora")}
            </Link>
            <Link href={toggleFilterHref("/shops", filters, "verified", "1")} className={verified ? chipActiveClass : chipClass}>
              {uiText(lang, "pill_checked")}
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
          lang={lang}
        />
      ) : null}
      {query ? <p className="text-sm text-ink/70">{uiFill(lang, "showing_shops", { q: query })}</p> : null}

      <p className="text-sm text-ink/60">{total === 0 ? "0 shops" : total === 1 ? "1 shop" : `${total} shops`}</p>
      {shops.length === 0 ? (
        <EmptyState
          title={uiText(lang, "no_shops_match")}
          body={uiText(lang, "no_shops_match_body")}
          action={
            <Link href="/shops" className={btnSecondary}>
              {uiText(lang, "clear_filters")}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} lite={lite} />
          ))}
        </div>
      )}
      <Pager page={page} pageCount={pageCount} hrefFor={(next) => pageHref(filters, next)} />
    </div>
  );
}
