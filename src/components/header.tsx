import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { APP_NAME } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { continueHref } from "@/lib/utils";

const navLink =
  "rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy";

export async function Header() {
  const user = await getSessionUser();
  const [openReports, shop] = await Promise.all([
    user?.role === "admin" ? prisma.report.count({ where: { status: "open" } }) : Promise.resolve(0),
    user ? prisma.storefront.findUnique({ where: { userId: user.id }, select: { id: true } }) : Promise.resolve(null),
  ]);
  const shopHref = continueHref(Boolean(user), "/account/storefront");
  const listHref = continueHref(Boolean(user), "/listings/new");
  const shopLabel = shop ? "Your shop" : "Open a shop";

  return (
    <header className="sticky top-0 z-30 border-b border-sand/80 bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy font-serif text-lg text-amber-soft shadow-sm transition-transform duration-150 group-hover:scale-[1.03]">
            {APP_NAME.slice(0, 1)}
          </span>
          <span className="truncate font-serif text-xl font-semibold tracking-tight text-navy">{APP_NAME}</span>
        </Link>

        <nav className="ml-auto flex flex-wrap items-center justify-end gap-1 text-sm font-medium sm:gap-1.5">
          <Link href="/listings" className={navLink}>
            Browse
          </Link>
          <Link href="/listings#search" className={`hidden sm:inline ${navLink}`}>
            Search
          </Link>
          <Link href={listHref} className={navLink}>
            <span className="md:hidden">List</span>
            <span className="hidden md:inline">List your business</span>
          </Link>
          <Link href="/upgrade" className={`hidden md:inline ${navLink}`}>
            Promote
          </Link>
          <Link
            href={shopHref}
            className="btn-press rounded-full bg-clay px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-clay-dark"
          >
            {shopLabel}
          </Link>
          {user?.role === "admin" ? (
            <Link href="/admin" className={navLink}>
              Admin{openReports > 0 ? ` (${openReports})` : ""}
            </Link>
          ) : null}
          {user ? (
            <>
              <Link href="/account" className={navLink}>
                Account
              </Link>
              <form action={signOutAction}>
                <button className="rounded-lg px-2.5 py-1.5 text-ink/55 transition-colors hover:bg-paper hover:text-navy">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-press ml-1 rounded-full bg-navy px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-soft"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
