import type { Metadata } from "next";
import Link from "next/link";
import { reviewModerationFlagAction } from "@/app/admin/ai/actions";
import { btnSecondary, fieldClass } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Moderation flags" };
export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminAiFlagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status = one(params.status) || "open";
  const kind = one(params.kind);
  const targetType = one(params.target);
  let rows: {
    id: string;
    targetType: string;
    targetId: string;
    source: string;
    kind: string;
    severity: string;
    reason: string;
    evidenceJson: string;
    createdAt: Date;
  }[] = [];
  try {
    rows = await prisma.moderationFlag.findMany({
      where: {
        status,
        ...(kind ? { kind } : {}),
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    rows = [];
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Moderation flags</h1>
        <p className="mt-2 text-sm text-ink/70">
          These are notes for a person to read. Nothing on this page hides, deletes, rejects, or verifies a listing or a
          shop video. A similar-video note stays here. Use the main moderation page when you decide to hide a listing.
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

      <form className="flex flex-wrap gap-2 text-sm" method="get">
        <select name="status" defaultValue={status} className={fieldClass}>
          <option value="open">Open</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned">Actioned</option>
        </select>
        <select name="kind" defaultValue={kind} className={fieldClass}>
          <option value="">Any kind</option>
          <option value="duplicate_photo">Similar photo</option>
          <option value="duplicate_video">Similar video</option>
          <option value="price_outlier">Price outlier</option>
          <option value="scam_text">Scam text</option>
          <option value="prohibited_item">Prohibited item</option>
          <option value="misleading">Misleading</option>
          <option value="contact_bypass">Contact bypass</option>
          <option value="off_category">Category</option>
          <option value="other">Other</option>
        </select>
        <select name="target" defaultValue={targetType} className={fieldClass}>
          <option value="">Any target</option>
          <option value="listing">Listing</option>
          <option value="offering">Offering</option>
          <option value="storefront">Shop</option>
          <option value="video">Video</option>
        </select>
        <button className={btnSecondary}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/70">No flags for this filter.</p>
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => {
            const href = row.targetType === "listing" ? `/listings/${row.targetId}` : "/admin";
            return (
              <li key={row.id} className="grid gap-2 rounded-2xl border border-sand bg-card p-4 text-sm">
                <p className="font-semibold text-navy">
                  <Link href={href} className="underline">
                    {row.targetType} {row.targetId.slice(0, 8)}
                  </Link>
                </p>
                <p className="text-ink/50">{row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
                <p>
                  <span className="font-semibold">{row.severity}</span> {row.kind} ({row.source})
                  {row.reason ? `: ${row.reason}` : null}
                </p>
                {status === "open" ? (
                  <form action={reviewModerationFlagAction} className="grid gap-2">
                    <input type="hidden" name="id" value={row.id} />
                    <input name="note" placeholder="Note (optional)" className={fieldClass} maxLength={500} />
                    <div className="flex flex-wrap gap-2">
                      <button name="action" value="dismiss" className={btnSecondary}>
                        Dismiss
                      </button>
                      <button name="action" value="actioned" className={btnSecondary}>
                        Mark actioned
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
