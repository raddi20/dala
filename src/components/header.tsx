import Link from "next/link";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { InstallAppLink } from "@/components/install-prompt";
import { LanguageSwitchControl } from "@/components/language-switch";
import { Wordmark } from "@/components/wordmark";
import { dholuoUiOn } from "@/lib/i18n/lang";
import { requestLang } from "@/lib/i18n/request-lang";
import { paymentsLive } from "@/lib/payments/live";
import { signOutAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { pwaNames } from "@/lib/pwa";
import { appName } from "@/lib/brand";
import { continueHref } from "@/lib/utils";

const deskLink =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-white/80 hover:text-white";
const menuLink =
  "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white";

export async function Header() {
  const user = await getSessionUser();
  const openReports =
    user?.role === "admin" ? await prisma.report.count({ where: { status: "open" } }) : 0;
  const listHref = continueHref(Boolean(user), "/listings/new");
  const paymentsOpen = paymentsLive();
  const lang = await requestLang();
  const showLang = dholuoUiOn();
  const installName = pwaNames(appName()).shortName;

  return (
    <>
      <header className="sticky top-0 z-30 bg-navy/95 text-white backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="group flex shrink-0 items-center">
            <Wordmark tone="onDark" truncate={false} />
          </Link>

          <nav className="ml-auto hidden min-w-0 items-center gap-0.5 md:flex" aria-label="Directory">
            {showLang ? <LanguageSwitchControl lang={lang} /> : null}
            <Link href="/listings" className={`${deskLink} hidden xl:inline-flex`}>
              Explore
            </Link>
            <Link href="/shops" className={`${deskLink} hidden xl:inline-flex`}>
              Shops
            </Link>
            <Link href="/occasions" className={`${deskLink} hidden xl:inline-flex`}>
              Occasions
            </Link>
            <details className="relative">
              <summary className={`${deskLink} cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden`}>
                More
              </summary>
              <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-white/15 bg-navy p-1 shadow-xl">
                <Link href="/listings" className={`${menuLink} xl:hidden`}>
                  Explore
                </Link>
                <Link href="/shops" className={`${menuLink} xl:hidden`}>
                  Shops
                </Link>
                <Link href="/occasions" className={`${menuLink} xl:hidden`}>
                  Occasions
                </Link>
                <Link href="/listings?region=diaspora" className={menuLink}>
                  For the diaspora
                </Link>
                <Link href="/send-home" className={menuLink}>
                  Send home
                </Link>
                <Link href="/business" className={menuLink}>
                  For shops
                </Link>
                {paymentsOpen ? (
                  <Link href="/pricing" className={menuLink}>
                    Pricing
                  </Link>
                ) : null}
                {user?.role === "admin" ? (
                  <Link href="/admin" className={menuLink}>
                    Admin{openReports > 0 ? ` (${openReports})` : ""}
                  </Link>
                ) : null}
                <Link href="/saved" className={menuLink}>
                  Saved
                </Link>
                <InstallAppLink appName={installName} className={`${menuLink} w-full text-left`} />
                {user ? (
                  <form action={signOutAction}>
                    <button className={`${menuLink} w-full text-left text-white/70`}>Sign out</button>
                  </form>
                ) : null}
              </div>
            </details>
            <Link
              href={listHref}
              data-tour="sell"
              className="ml-1 inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-gold-l px-3.5 text-sm font-semibold text-gold-l"
            >
              List your business free
            </Link>
            {user ? (
              <Link href="/account" className={deskLink}>
                Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="ml-1 inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 px-3.5 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:hidden">
            {showLang ? <LanguageSwitchControl lang={lang} /> : null}
            <Link href="/saved" aria-label="Saved" data-saved-link className="inline-flex h-11 w-11 items-center justify-center text-white/90">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M12 20.5s-7.5-4.4-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 2.9 1.5-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </Link>
            {user?.role === "admin" ? (
              <Link href="/admin" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-white">
                Admin{openReports > 0 ? ` (${openReports})` : ""}
              </Link>
            ) : null}
            {user ? (
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-3 text-sm font-semibold"
              >
                Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-3.5 text-sm font-semibold"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <BottomNav sellHref={listHref} lang={lang} />
      </Suspense>
    </>
  );
}
