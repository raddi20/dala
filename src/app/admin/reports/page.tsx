import type { Metadata } from "next";
import Link from "next/link";
import { btnDanger, btnSecondary } from "@/components/ui";
import { resolveReport } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  await requireAdmin("/admin/reports");
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { name: true, email: true } },
      listing: { select: { id: true, title: true } },
      targetUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
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
    </div>
  );
}
