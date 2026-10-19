"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ASK_HREF, activeBottomTab, type BottomTab } from "@/lib/bottom-nav";
import type { Lang } from "@/lib/i18n/lang";
import { uiText, type StringKey } from "@/lib/i18n/strings";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function TabIcon({ id }: { id: BottomTab }) {
  if (id === "home") {
    return (
      <Icon>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </Icon>
    );
  }
  if (id === "explore") {
    return (
      <Icon>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </Icon>
    );
  }
  if (id === "occasions") {
    return (
      <Icon>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" />
      </Icon>
    );
  }
  if (id === "sell") {
    return (
      <Icon>
        <path d="M6 8h12l-1 12H7z" />
        <path d="M9 8V7a3 3 0 0 1 6 0v1" />
      </Icon>
    );
  }
  return (
    <Icon>
      <path d="M12 3.5 13.4 8H18l-3.7 2.8L15.6 16 12 13.2 8.4 16l1.3-5.2L6 8h4.6z" />
    </Icon>
  );
}

const TABS: { id: BottomTab; label: StringKey }[] = [
  { id: "home", label: "nav_home" },
  { id: "explore", label: "nav_explore" },
  { id: "ask", label: "nav_ask" },
  { id: "occasions", label: "nav_occasions" },
  { id: "sell", label: "nav_sell" },
];

export function BottomNav({ sellHref, lang = "en" }: { sellHref: string; lang?: Lang }) {
  const pathname = usePathname() || "/";
  const search = useSearchParams().toString();
  const active = activeBottomTab(pathname, search);
  const hrefFor = (id: BottomTab) => {
    if (id === "home") return "/";
    if (id === "explore") return "/listings";
    if (id === "ask") return ASK_HREF;
    if (id === "occasions") return "/occasions";
    return sellHref;
  };

  return (
    <nav
      aria-label="Primary"
      data-tour="nav"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        {TABS.map((tab) => {
          const on = active === tab.id;
          const ask = tab.id === "ask";
          return (
            <Link
              key={tab.id}
              href={hrefFor(tab.id)}
              data-tour={tab.id === "sell" ? "sell" : undefined}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                ask ? "text-gold-d" : on ? "text-navy" : "text-muted"
              }`}
            >
              {ask ? (
                <span className="grid h-[52px] w-[52px] -translate-y-3 place-items-center rounded-full bg-gold text-navy shadow-[0_6px_18px_rgb(200_136_26/0.45)] ring-4 ring-white">
                  <TabIcon id="ask" />
                </span>
              ) : (
                <TabIcon id={tab.id} />
              )}
              {uiText(lang, tab.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
