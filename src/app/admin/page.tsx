import type { Metadata } from "next";
import Link from "next/link";
import { btnDanger, btnSecondary } from "@/components/ui";
import { resolveReport, setListingHidden, setListingVerified, setVerifiedPro } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [listings, reports, users] = await Promise.all([
    prisma.listing.findMany({
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.report.findMany({
      include: {
        reporter: { select: { name: true, email: true } },
        listing: { select: { id: true, title: true } },
        targetUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, city: true, verifiedPro: true, kind: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const ordered = [...listings].sort((a, b) => (rank[a.scamRisk] ?? 3) - (rank[b.scamRisk] ?? 3));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Moderation</h1>
        <p className="mt-1 text-sm text-ink/70">Hide listings, grant the verified badge, and close reports. Verified Pro is the paid stub.</p>
      </div>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Reports</h2>
        {reports.length === 0 ? <p className="text-sm text-ink/70">No reports.</p> : null}
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <p className="font-semibold">
              {report.reason} · {report.status}
            </p>
            <p className="mt-1 text-ink/70">
              From {report.reporter.name} ({report.reporter.email}) · {formatWhen(report.createdAt)}
            </p>
            {report.listing ? (
              <p>
                Listing:{" "}
                <Link href={`/listings/${report.listing.id}`} className="font-semibold text-lake-dark">
                  {report.listing.title}
                </Link>
              </p>
            ) : null}
            {report.targetUser ? (
              <p>
                Person:{" "}
                <Link href={`/people/${report.targetUser.id}`} className="font-semibold text-lake-dark">
                  {report.targetUser.name}
                </Link>
              </p>
            ) : null}
            {report.details ? <p className="mt-2 whitespace-pre-wrap">{report.details}</p> : null}
            {report.status === "open" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={resolveReport}>
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="status" value="dismissed" />
                  <button className={btnSecondary}>Dismiss</button>
                </form>
                {report.listingId ? (
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <input type="hidden" name="status" value="actioned" />
                    <input type="hidden" name="hide" value="1" />
                    <button className={btnDanger}>Hide listing and close</button>
                  </form>
                ) : (
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <input type="hidden" name="status" value="actioned" />
                    <button className={btnSecondary}>Mark actioned</button>
                  </form>
                )}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Listings</h2>
        {ordered.map((listing) => (
          <article key={listing.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/listings/${listing.id}`} className="font-semibold">
                {listing.title}
              </Link>
              <span className="text-ink/60">{listing.hidden ? "Hidden" : "Visible"}</span>
            </div>
            <p className="text-ink/70">
              {listing.city} · {listing.type} · {listing.owner.name} · risk {listing.scamRisk}
              {listing.verified ? " · verified" : ""}
            </p>
            {listing.scamNotes ? <p className="mt-1">{listing.scamNotes}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={setListingHidden}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="hidden" value={listing.hidden ? "0" : "1"} />
                <button className={btnSecondary}>{listing.hidden ? "Unhide" : "Hide"}</button>
              </form>
              <form action={setListingVerified}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="verified" value={listing.verified ? "0" : "1"} />
                <button className={btnSecondary}>{listing.verified ? "Remove verified" : "Grant verified"}</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">People</h2>
        {users.map((person) => (
          <article key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-card p-4 text-sm">
            <div>
              <Link href={`/people/${person.id}`} className="font-semibold">
                {person.name}
              </Link>
              <p className="text-ink/70">
                {person.email} · {person.kind} · {person.city}
                {person.role === "admin" ? " · admin" : ""}
                {person.verifiedPro ? " · Verified Pro" : ""}
              </p>
            </div>
            <form action={setVerifiedPro}>
              <input type="hidden" name="userId" value={person.id} />
              <input type="hidden" name="value" value={person.verifiedPro ? "0" : "1"} />
              <button className={btnSecondary}>{person.verifiedPro ? "Remove Pro" : "Grant Pro"}</button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
