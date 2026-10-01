import type { Metadata } from "next";
import Link from "next/link";
import { dismissModerationSuggestion } from "@/app/admin/ai/actions";
import { btnSecondary } from "@/components/ui";
import { readStoredFlags } from "@/lib/ai/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Moderation suggestions" };
export const dynamic = "force-dynamic";

export default async function AdminAiFlagsPage() {
  await requireAdmin();
  let rows: {
    id: string;
    listingId: string;
    suggestedCategory: string;
    duplicateIds: string;
    flagsJson: string;
    createdAt: Date;
  }[] = [];
  try {
    rows = await prisma.aiModerationSuggestion.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        listingId: true,
        suggestedCategory: true,
        duplicateIds: true,
        flagsJson: true,
        createdAt: true,
      },
    });
  } catch {
    rows = [];
  }

  const ids = [...new Set(rows.map((row) => row.listingId).filter(Boolean))];
  let titles = new Map<string, string>();
  if (ids.length > 0) {
    try {
      const listings = await prisma.listing.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true },
      });
      titles = new Map(listings.map((listing) => [listing.id, listing.title]));
    } catch {
      titles = new Map();
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Moderation suggestions</h1>
        <p className="mt-2 text-sm text-ink/70">
          These are notes for a person to read. Nothing on this page hides, deletes, rejects, or verifies a listing. Use
          the main moderation page when you decide to hide one.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin/ai" className="font-semibold text-lake-dark underline">
            AI usage
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Moderation
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/70">No open suggestions.</p>
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => {
            const flags = readStoredFlags(row.flagsJson);
            const duplicates = row.duplicateIds.split(",").map((id) => id.trim()).filter(Boolean);
            const title = titles.get(row.listingId) || "Listing";
            return (
              <li key={row.id} className="grid gap-2 rounded-2xl border border-sand bg-card p-4 text-sm">
                <p className="font-semibold text-navy">
                  <Link href={`/listings/${row.listingId}`} className="underline">
                    {title}
                  </Link>
                </p>
                <p className="text-ink/50">{row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
                {row.suggestedCategory ? (
                  <p>Suggested category: {row.suggestedCategory}. The listing category is unchanged.</p>
                ) : null}
                {duplicates.length > 0 ? (
                  <p>
                    Same photo as{" "}
                    {duplicates.map((id, index) => (
                      <span key={id}>
                        {index > 0 ? ", " : null}
                        <Link href={`/listings/${id}`} className="font-semibold text-lake-dark underline">
                          {id.slice(0, 8)}
                        </Link>
                      </span>
                    ))}
                    .
                  </p>
                ) : null}
                <ul className="grid gap-1">
                  {flags.map((flag, index) => (
                    <li key={`${flag.kind}-${index}`}>
                      <span className="font-semibold">{flag.severity}</span> {flag.kind}: {flag.reason}
                      {flag.evidence ? <span className="text-ink/60"> — {flag.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
                <form action={dismissModerationSuggestion}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className={btnSecondary}>Dismiss suggestion</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
