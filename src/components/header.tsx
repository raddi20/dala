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
    <header className="sticky top-0 z-20 border-b border-sand bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-lake font-serif text-lg text-white">
            {APP_NAME.slice(0, 1)}
          </span>
          <span className="font-serif text-xl font-semibold">{APP_NAME}</span>
        </Link>
        <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm font-medium">
          <Link href="/listings" className="hover:underline">
            Browse
          </Link>
          <Link href="/listings/new" className="hover:underline">
            Add
          </Link>
          <Link href="/upgrade" className="hover:underline">
            Promote
          </Link>
          {user?.role === "admin" ? (
            <Link href="/admin" className="hover:underline">
              Admin{openReports > 0 ? ` (${openReports})` : ""}
            </Link>
          ) : null}
          {user ? (
            <>
              <Link href="/account" className="hover:underline">
                Account
              </Link>
              <form action={signOutAction}>
                <button className="text-ink/70 hover:underline">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-lake px-3 py-1.5 text-white">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
