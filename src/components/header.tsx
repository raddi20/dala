import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { APP_NAME } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function Header() {
  const user = await getSessionUser();
  const openReports =
    user?.role === "admin" ? await prisma.report.count({ where: { status: "open" } }) : 0;

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
          <Link
            href="/listings"
            className="rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy"
          >
            Browse
          </Link>
          <Link
            href="/listings#search"
            className="hidden rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy sm:inline"
          >
            Search
          </Link>
          <Link
            href="/listings/new"
            className="hidden rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy sm:inline"
          >
            Add
          </Link>
          <Link
            href="/upgrade"
            className="hidden rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy md:inline"
          >
            Promote
          </Link>
          {user?.role === "admin" ? (
            <Link
              href="/admin"
              className="rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy"
            >
              Admin{openReports > 0 ? ` (${openReports})` : ""}
            </Link>
          ) : null}
          {user ? (
            <>
              <Link
                href="/account"
                className="rounded-lg px-2.5 py-1.5 text-ink/80 transition-colors hover:bg-paper hover:text-navy"
              >
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
