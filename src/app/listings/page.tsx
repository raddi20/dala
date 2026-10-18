import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BrowseHits } from "@/components/browse-hits";
import { Pager } from "@/components/pager";
import { FilterSheet, ListingFilterForm, ResultsSearchBar, UnderstoodRow } from "@/components/results-chrome";
import { EmptyState, btnSecondary, chipActiveClass, chipClass } from "@/components/ui";
import { AUDIENCE_LINE, appName } from "@/lib/brand";
import { categoryHref, isCategory } from "@/lib/categories";
import { activeBrowseRegion, browseRegionChipHref, chosenBrowseCity } from "@/lib/browse-filters";
import { cityChipLabel, cityInPhrase, isCityName } from "@/lib/constants";
import { wantsDiasporaOrders } from "@/lib/diaspora";
import { publicOrigin } from "@/lib/payments/origin";
import { buildShareMetadata } from "@/lib/share-metadata";
import { parseShopBadgeFilter } from "@/lib/shop-badges";
import { visitorActorHash } from "@/lib/ai/actor";
import { interpretSearch } from "@/lib/ai/search-parse";
import { browsePage, searchCatalogue } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { browseHref, chipBag, matchCountLabel, toggleFilterHref, understoodChips } from "@/lib/understood-chips";
import { requestLang } from "@/lib/i18n/request-lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
import { one } from "@/lib/utils";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const category = one(sp.category);
  const city = chosenBrowseCity(one(sp.city));
  const origin = await publicOrigin();
  const name = appName();
  if (isCategory(category)) {
    return buildShareMetadata({
      origin,
      path: categoryHref(category),
      title: category,
      description: `${category} from Luo shops and classifieds in ${AUDIENCE_LINE} on ${name}.`,
      image: `/og/category/${encodeURIComponent(category)}`,
      imageAlt: `${category} on ${name}`,
    });
  }
  const title = isCityName(city) ? cityChipLabel(city) : "Browse";
  const description = isCityName(city)
    ? `Luo shops and classifieds ${cityInPhrase(city)} on ${name}.`
    : `Directory and classifieds in ${AUDIENCE_LINE} on ${name}.`;
  const region = one(sp.region);
  const path = isCityName(city)
    ? `/listings?city=${encodeURIComponent(city)}${region === "homeland" || region === "diaspora" ? `&region=${region}` : ""}`
    : "/listings";
  return buildShareMetadata({
    origin,
    path,
    title,
    description,
    image: "/listings/opengraph-image",
    imageAlt: `${title} on ${name}`,
  });
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nlRaw = one(sp.nl).trim();
  const jar = await cookies();
  const actorHash = visitorActorHash(jar.get("rangach_visitor")?.value ?? "") ?? undefined;
  const parsed = nlRaw ? await interpretSearch(nlRaw, { actorHash }) : null;
  const explicitQ = one(sp.q).trim();
  const filters = {
    q: explicitQ,
    city: chosenBrowseCity(one(sp.city), parsed?.city || ""),
    region: one(sp.region) || parsed?.region || "",
    category: one(sp.category) || parsed?.category || "",
    type: one(sp.type) || parsed?.type || "",
    verified: one(sp.verified) === "1" || parsed?.verified === true,
    badge: parseShopBadgeFilter(one(sp.badge)) ?? "",
    diaspora: wantsDiasporaOrders(one(sp.diaspora)),
    occasion: one(sp.occasion) || parsed?.occasion || "",
  };
  const hints = explicitQ ? [] : parsed?.hints ?? [];
  const structured = Boolean(
    filters.city || filters.region || filters.category || filters.type || filters.verified || filters.badge || filters.diaspora || filters.occasion,
  );
  const optionalWords = !explicitQ && !structured ? hints : [];
  const chipBase = chipBag({ ...filters, nl: nlRaw });
  const user = await getSessionUser();
  const page = browsePage(one(sp.page));
  let result = await searchCatalogue({
    ...filters,
    words: optionalWords,
    hints: structured ? hints : [],
    viewerId: user?.id,
    page,
  });
  let droppedWords = false;
  if (result.total === 0 && optionalWords.length > 0) {
    result = await searchCatalogue({ ...filters, viewerId: user?.id, page });
    droppedWords = true;
  }
  const origin = await publicOrigin();
  const lang = await requestLang();
  const closeHref = browseHref("/listings", chipBase);
  const sheetActive = Boolean(
    filters.city || filters.category || filters.badge || filters.diaspora || filters.occasion || (filters.type && filters.type !== "business"),
  );
  const chips = parsed ? understoodChips("/listings", chipBase, hints) : [];

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-4">
      <h1 className="sr-only">{uiText(lang, "browse_title")}</h1>
      <ResultsSearchBar
        action="/listings"
        inputId="nl"
        inputName="nl"
        defaultValue={nlRaw}
        label={uiText(lang, "home_search_label")}
        lang={lang}
        sheet={
          <FilterSheet active={sheetActive} closeHref={closeHref} lang={lang}>
            <ListingFilterForm
              action="/listings"
              clearHref="/listings"
              hidden={{ nl: nlRaw, q: filters.q, occasion: filters.occasion }}
              region={filters.region}
              city={filters.city}
              category={filters.category}
              type={filters.type}
              badge={filters.badge}
              verified={filters.verified}
              diaspora={filters.diaspora}
              lang={lang}
            />
          </FilterSheet>
        }
        pills={
          <>
            <Link
              href={browseRegionChipHref(chipBase, "homeland")}
              className={activeBrowseRegion(filters.city, filters.region) === "homeland" ? chipActiveClass : chipClass}
            >
              {uiText(lang, "homeland")}
            </Link>
            <Link
              href={browseRegionChipHref(chipBase, "diaspora")}
              className={activeBrowseRegion(filters.city, filters.region) === "diaspora" ? chipActiveClass : chipClass}
            >
              {uiText(lang, "diaspora")}
            </Link>
            <Link
              href={toggleFilterHref("/listings", chipBase, "verified", "1")}
              className={filters.verified ? chipActiveClass : chipClass}
            >
              {uiText(lang, "pill_checked")}
            </Link>
            <Link
              href={toggleFilterHref("/listings", chipBase, "type", "business")}
              className={filters.type === "business" ? chipActiveClass : chipClass}
            >
              {uiText(lang, "chip_shops")}
            </Link>
          </>
        }
      />

      {parsed ? (
        <UnderstoodRow
          chips={chips}
          spark={parsed.assist === "smart"}
          assist={parsed.assist}
          droppedWords={droppedWords}
          lang={lang}
        />
      ) : null}

      <p className="text-sm text-ink/60">
        {filters.q ? <>{uiFill(lang, "matches_for", { q: filters.q })} </> : null}
        {matchCountLabel(result.total, result.page, result.pageSize)}
      </p>
      {result.hits.length === 0 ? (
        <EmptyState
          title={uiText(lang, "nothing_matches")}
          body={uiText(lang, "nothing_matches_body")}
          action={
            <Link href="/listings" className={btnSecondary}>
              {uiText(lang, "clear_filters")}
            </Link>
          }
        />
      ) : (
        <BrowseHits hits={result.hits} origin={origin} occasionSlug={filters.occasion} />
      )}
      <Pager page={result.page} pageCount={result.pageCount} hrefFor={(next) => browseHref("/listings", chipBase, next)} />
    </div>
  );
}
