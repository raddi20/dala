import Link from "next/link";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Wordmark } from "@/components/wordmark";
import { paymentsLive } from "@/lib/payments/live";
import { signOutAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { continueHref } from "@/lib/utils";

const deskLink = "inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-white/80 hover:text-white";

export async function Header() {
  const user = await getSessionUser();
  const openReports =
    user?.role === "admin" ? await prisma.report.count({ where: { status: "open" } }) : 0;
  const listHref = continueHref(Boolean(user), "/listings/new");
  const paymentsOpen = paymentsLive();

  return (
    <>
      <header className="sticky top-0 z-30 bg-navy/95 text-white backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="group flex min-w-0 items-center">
            <Wordmark tone="onDark" />
          </Link>

          <nav className="ml-auto hidden items-center gap-0.5 md:flex" aria-label="Directory">
            <Link href="/listings" className={deskLink}>
              Explore
            </Link>
            <Link href="/shops" className={deskLink}>
              Shops
            </Link>
            <Link href="/occasions" className={deskLink}>
              Occasions
            </Link>
            <Link href="/listings?region=diaspora" className={deskLink}>
              For the diaspora
            </Link>
            <Link href="/send-home" className={deskLink}>
              Send home
            </Link>
            {paymentsOpen ? (
              <Link href="/pricing" className={deskLink}>
                Pricing
              </Link>
            ) : null}
            {user?.role === "admin" ? (
              <Link href="/admin" className={deskLink}>
                Admin{openReports > 0 ? ` (${openReports})` : ""}
              </Link>
            ) : null}
            <Link
              href={listHref}
              className="ml-1 inline-flex min-h-11 items-center rounded-full border border-gold-l px-3.5 text-sm font-semibold text-gold-l"
            >
              List your business free
            </Link>
            {user ? (
              <>
                <Link href="/account" className={deskLink}>
                  Account
                </Link>
                <form action={signOutAction}>
                  <button className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-white/70 hover:text-white">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="ml-1 inline-flex min-h-11 items-center rounded-full border border-white/30 px-3.5 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:hidden">
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
        <BottomNav sellHref={listHref} />
      </Suspense>
    </>
  );
}
