import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryOptions } from "@/components/category-options";
import { btnPrimary, btnSecondary, chipActiveClass, chipClass, fieldClass } from "@/components/ui";
import { HOME_ASK_PLACEHOLDER } from "@/lib/home-prompts";
import { LISTING_TYPES } from "@/lib/constants";
import { DIASPORA_ORDERS_LABEL } from "@/lib/diaspora";
import { familiesAlsoNeed } from "@/lib/occasion-needs";
import { SHOP_BADGE_FILTERS } from "@/lib/shop-badges";
import { DROPPED_WORDS_NOTE, type UnderstoodChip } from "@/lib/understood-chips";
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
}: {
  action: string;
  inputId: string;
  inputName: string;
  defaultValue: string;
  label: string;
  sheet: ReactNode;
  pills: ReactNode;
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
            placeholder={HOME_ASK_PLACEHOLDER}
            className={searchFieldClass}
          />
        </label>
        <button className={`${btnPrimary} shrink-0 px-3`}>Search</button>
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
}: {
  active: boolean;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <details className="filter-sheet shrink-0">
      <summary className={active ? chipActiveClass : chipClass}>
        <span className="inline-flex items-center gap-1">
          Filters
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M4 6h16v2H4V6zm3 5h10v2H7v-2zm2 5h6v2H9v-2z" />
          </svg>
        </span>
      </summary>
      <div className="filter-sheet-layer">
        <a className="filter-sheet-scrim" href={closeHref} aria-label="Close filters" />
        <div className="filter-sheet-panel" role="dialog" aria-label="Filters">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl text-navy">Filters</h2>
            <a href={closeHref} className="text-sm font-semibold text-gold-d">
              Close
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
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-2">
      <HiddenFields fields={hidden} />
      <label className="block text-sm font-medium text-ink/80">
        Homeland or Diaspora
        <select name="region" defaultValue={activeBrowseRegion(city, region)} className={fieldClass}>
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
      <label className="block text-sm font-medium text-ink/80">
        Type
        <select name="type" defaultValue={type} className={fieldClass}>
          <option value="">Any</option>
          <option value="classifieds">All classifieds</option>
          {LISTING_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink/80">
        Shop badge
        <select name="badge" defaultValue={badge} className={fieldClass}>
          <option value="">Any</option>
          {SHOP_BADGE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="verified" value="1" defaultChecked={verified} className="size-4 rounded border-sand" />
        Checked only
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="diaspora" value="1" defaultChecked={diaspora} className="size-4 rounded border-sand" />
        {DIASPORA_ORDERS_LABEL}
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={btnPrimary}>Apply filters</button>
        <Link href={clearHref} className={btnSecondary}>
          Clear
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
}: {
  action: string;
  clearHref: string;
  hidden: Record<string, string>;
  region: string;
  city: string;
  category: string;
  verified: boolean;
  diaspora: boolean;
}) {
  return (
    <form action={action} method="get" className="grid gap-3 sm:grid-cols-2">
      <HiddenFields fields={hidden} />
      <label className="block text-sm font-medium text-ink/80">
        Homeland or Diaspora
        <select name="region" defaultValue={activeBrowseRegion(city, region)} className={fieldClass}>
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
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="verified" value="1" defaultChecked={verified} className="size-4 rounded border-sand" />
        Checked shops
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
        <input type="checkbox" name="diaspora" value="1" defaultChecked={diaspora} className="size-4 rounded border-sand" />
        {DIASPORA_ORDERS_LABEL}
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button className={btnPrimary}>Apply filters</button>
        <Link href={clearHref} className={btnSecondary}>
          Clear
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
}: {
  chips: UnderstoodChip[];
  spark: boolean;
  assist: "rules" | "smart" | "fallback";
  droppedWords: boolean;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-navy">
        {spark ? (
          <span className="text-gold-d" aria-hidden="true">
            ✦{" "}
          </span>
        ) : null}
        Rangach understood
      </p>
      {assist === "fallback" ? (
        <p className="text-sm text-muted">Smart search did not answer. Showing the plain reading.</p>
      ) : null}
      {chips.length > 0 ? (
        <ul className="chip-scroll">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link href={chip.href} className={`${chipClass} gap-1.5 bg-cream`}>
                {chip.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove {chip.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No filters detected.</p>
      )}
      {droppedWords ? <p className="text-sm text-muted">{DROPPED_WORDS_NOTE}</p> : null}
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
