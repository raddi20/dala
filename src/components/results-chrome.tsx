import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryOptions } from "@/components/category-options";
import { btnPrimary, btnSecondary, chipActiveClass, chipClass, fieldClass } from "@/components/ui";
import { HOME_ASK_PLACEHOLDER } from "@/lib/home-prompts";
import { LISTING_TYPES, canonicalCity } from "@/lib/constants";
import { TownOptions } from "@/components/town-options";
import type { Lang } from "@/lib/i18n/lang";
import { uiText, type StringKey } from "@/lib/i18n/strings";
import { familiesAlsoNeed } from "@/lib/occasion-needs";
import { SHOP_BADGE_FILTERS } from "@/lib/shop-badges";
import { type UnderstoodChip } from "@/lib/understood-chips";
import { activeBrowseRegion } from "@/lib/browse-filters";

const searchFieldClass =
  "min-h-11 w-full rounded-[14px] border border-gold bg-white py-2.5 pl-9 pr-3 text-base text-ink shadow-sm placeholder:text-muted focus:border-gold-d focus:outline-none focus:ring-2 focus:ring-gold/30";

export function ResultsSearchBar({
  action,
  inputId,
  inputName,
  defaultValue,
  label,
  sheet,
  pills,
  lang = "en",
}: {
  action: string;
  inputId: string;
  inputName: string;
  defaultValue: string;
  label: string;
  sheet: ReactNode;
  pills: ReactNode;
  lang?: Lang;
}) {
  return (
    <div className="results-search-bar sticky top-14 z-20 -mx-4 border-b border-line/80 bg-bg px-4 py-3">
      <form id={inputId === "nl" ? "search" : undefined} action={action} method="get" className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1" htmlFor={inputId}>
          <span className="sr-only">{label}</span>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gold-d">
            ✦
          </span>
          <input
            id={inputId}
            name={inputName}
            defaultValue={defaultValue}
            placeholder={lang === "dholuo" ? uiText(lang, "ask_placeholder") : HOME_ASK_PLACEHOLDER}
            className={searchFieldClass}
          />
        </label>
        <button className={`${btnPrimary} shrink-0 px-3`}>{uiText(lang, "search_button")}</button>
      </form>
      <div className="mt-2 flex items-start gap-2">
        {sheet}
        <div className="chip-scroll min-w-0 flex-1">{pills}</div>
      </div>
    </div>
  );
}

export function FilterSheet({
  active,
  closeHref,
  children,
  lang = "en",
}: {
  active: boolean;
  closeHref: string;
  children: ReactNode;
  lang?: Lang;
}) {
  return (
    <details className="filter-sheet shrink-0">
      <summary className={active ? chipActiveClass : chipClass}>
        <span className="inline-flex items-center gap-1">
          {uiText(lang, "filters")}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M4 6h16v2H4V6zm3 5h10v2H7v-2zm2 5h6v2H9v-2z" />
          </svg>
        </span>
      </summary>
      <div className="filter-sheet-layer">
        <a className="filter-sheet-scrim" href={closeHref} aria-label={uiText(lang, "close_filters")} />
        <div className="filter-sheet-panel" role="dialog" aria-label={uiText(lang, "filters")}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl text-navy">{uiText(lang, "filters")}</h2>
            <a href={closeHref} className="text-sm font-semibold text-gold-d">
              {uiText(lang, "close")}
            </a>
          </div>
          {children}
        </div>
      </div>
    </details>
  );
}

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return Object.entries(fields).map(([name, value]) =>
    value ? <input key={name} type="hidden" name={name} value={value} /> : null,
  );
}

const TYPE_LABEL: Record<(typeof LISTING_TYPES)[number]["value"], StringKey> = {
  business: "type_business",
  for_sale: "type_for_sale",
  wanted: "type_wanted",
  housing: "type_housing",
  services: "type_services",
};

const BADGE_LABEL: Record<(typeof SHOP_BADGE_FILTERS)[number]["value"], StringKey> = {
  any: "badge_any",
  phone: "badge_phone",
  location: "badge_location",
  business: "badge_business",
};

export function ListingFilterForm({
  action,
  clearHref,
  hidden,
  region,
  city,
  category,
  type,
  badge,
  verified,
  diaspora,
  lang = "en",
}: {
  action: string;
  clearHref: string;
  hidden: Record<string, string>;
  region: string;
  city: string;
  category: string;
  type: string;
  badge: string;
  verified: boolean;
  diaspora: boolean;
  lang?: Lang;
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-2">
      <HiddenFields fields={hidden} />
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "place_label")}
        <select name="region" defaultValue={activeBrowseRegion(city, region)} className={fieldClass}>
          <option value="">{uiText(lang, "any")}</option>
          <option value="homeland">{uiText(lang, "homeland")}</option>
          <option value="diaspora">{uiText(lang, "diaspora")}</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "town")}
        <select name="city" defaultValue={canonicalCity(city)} className={fieldClass}>
          <TownOptions includeDiaspora blank={uiText(lang, "any_town")} />
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "category")}
        <select name="category" defaultValue={category} className={fieldClass}>
          <CategoryOptions blank={uiText(lang, "any")} />
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "type")}
        <select name="type" defaultValue={type} className={fieldClass}>
          <option value="">{uiText(lang, "any")}</option>
          <option value="classifieds">{uiText(lang, "all_classifieds")}</option>
          {LISTING_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {uiText(lang, TYPE_LABEL[item.value])}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "shop_badge")}
        <select name="badge" defaultValue={badge} className={fieldClass}>
          <option value="">{uiText(lang, "any")}</option>
          {SHOP_BADGE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {uiText(lang, BADGE_LABEL[filter.value])}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="verified" value="1" defaultChecked={verified} className="size-4 rounded border-sand" />
        {uiText(lang, "checked_only")}
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="diaspora" value="1" defaultChecked={diaspora} className="size-4 rounded border-sand" />
        {uiText(lang, "diaspora_orders")}
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={btnPrimary}>{uiText(lang, "apply_filters")}</button>
        <Link href={clearHref} className={btnSecondary}>
          {uiText(lang, "clear")}
        </Link>
      </div>
    </form>
  );
}

export function ShopFilterForm({
  action,
  clearHref,
  hidden,
  region,
  city,
  category,
  verified,
  diaspora,
  lang = "en",
}: {
  action: string;
  clearHref: string;
  hidden: Record<string, string>;
  region: string;
  city: string;
  category: string;
  verified: boolean;
  diaspora: boolean;
  lang?: Lang;
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-2">
      <HiddenFields fields={hidden} />
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "place_label")}
        <select name="region" defaultValue={activeBrowseRegion(city, region)} className={fieldClass}>
          <option value="">{uiText(lang, "any")}</option>
          <option value="homeland">{uiText(lang, "homeland")}</option>
          <option value="diaspora">{uiText(lang, "diaspora")}</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "town")}
        <select name="city" defaultValue={canonicalCity(city)} className={fieldClass}>
          <TownOptions includeDiaspora blank={uiText(lang, "any_town")} />
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        {uiText(lang, "category")}
        <select name="category" defaultValue={category} className={fieldClass}>
          <CategoryOptions blank={uiText(lang, "any")} />
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="verified" value="1" defaultChecked={verified} className="size-4 rounded border-sand" />
        {uiText(lang, "checked_shops")}
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="diaspora" value="1" defaultChecked={diaspora} className="size-4 rounded border-sand" />
        {uiText(lang, "diaspora_orders")}
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={btnPrimary}>{uiText(lang, "apply_filters")}</button>
        <Link href={clearHref} className={btnSecondary}>
          {uiText(lang, "clear")}
        </Link>
      </div>
    </form>
  );
}

export function UnderstoodRow({
  chips,
  spark,
  assist,
  droppedWords,
  lang = "en",
}: {
  chips: UnderstoodChip[];
  spark: boolean;
  assist: "rules" | "smart" | "fallback";
  droppedWords: boolean;
  lang?: Lang;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-navy">
        {spark ? (
          <span className="text-gold-d" aria-hidden="true">
            ✦{" "}
          </span>
        ) : null}
        {uiText(lang, "understood")}
      </p>
      {assist === "fallback" ? <p className="text-sm text-muted">{uiText(lang, "understood_fallback")}</p> : null}
      {chips.length > 0 ? (
        <ul className="chip-scroll">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link href={chip.href} className={`${chipClass} gap-1.5 bg-cream`}>
                {chip.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">
                  {uiText(lang, "remove")} {chip.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{uiText(lang, "no_filters")}</p>
      )}
      {droppedWords ? <p className="text-sm text-muted">{uiText(lang, "dropped_words")}</p> : null}
    </div>
  );
}

export function OccasionNeeds({ slug }: { slug: string }) {
  const band = familiesAlsoNeed(slug);
  if (!band) return null;
  return (
    <aside className="rounded-[14px] border border-line/80 bg-cream px-3 py-3">
      <p className="text-sm font-semibold text-navy">{band.heading}</p>
      <div className="chip-scroll mt-2">
        {band.items.map((item) => (
          <Link key={item.label} href={item.href} className={chipClass}>
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
