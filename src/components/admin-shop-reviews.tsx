import Link from "next/link";
import { ReasonInput } from "@/components/admin-reason";
import { btnDanger, btnSecondary } from "@/components/ui";
import { setShopReviewStatus } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { starText } from "@/lib/shop-review";
import { formatWhen } from "@/lib/utils";

const LABEL: Record<string, string> = { pending: "Waiting for approval", approved: "Visible", hidden: "Hidden" };

/** Shop ratings. Held ones (a link or phone number) first, then the latest. Approve, hide, or restore. */
export async function AdminShopReviews() {
  const [pending, latest] = await Promise.all([
    prisma.shopReview.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 50 }),
    prisma.shopReview.findMany({ where: { status: { not: "pending" } }, orderBy: { updatedAt: "desc" }, take: 40 }),
  ]);
  const rows = [...pending, ...latest];
  const [authors, shops] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: rows.map((row) => row.authorId) } }, select: { id: true, name: true, email: true } }),
    prisma.storefront.findMany({
      where: { id: { in: rows.map((row) => row.storefrontId) } },
      select: { id: true, slug: true, user: { select: { name: true } } },
    }),
  ]);
  const authorBy = new Map(authors.map((row) => [row.id, row]));
  const shopBy = new Map(shops.map((row) => [row.id, row]));

  return (
    <section className="grid gap-3" id="shop-reviews" data-admin-shop-reviews>
      <h2 className="font-serif text-2xl">Shop ratings</h2>
      <p className="text-sm text-ink/70">
        {pending.length} waiting for approval. Swear words are refused when posted. A link or phone number holds a rating here until
        you approve it.
      </p>
      {rows.length === 0 ? <p className="text-sm text-ink/70">No shop ratings.</p> : null}
      {rows.map((row) => {
        const author = authorBy.get(row.authorId);
        const shop = shopBy.get(row.storefrontId);
        return (
          <article key={row.id} className="rounded-2xl border border-sand bg-card p-4 text-sm" data-shop-review-status={row.status}>
            <p className="font-semibold">
              <span className="text-gold">{starText(row.rating)}</span> · {author?.name ?? "Unknown"} · {LABEL[row.status] ?? row.status}
            </p>
            <p className="text-ink/70">
              {author?.email ?? ""} · {formatWhen(row.createdAt)}
              {shop ? (
                <>
                  {" · "}
                  <Link href={`/b/${shop.slug}#rate`} className="font-semibold text-lake-dark">
                    {shop.user.name}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
            {row.hiddenReason ? <p className="mt-1 text-ink/70">{row.hiddenReason}</p> : null}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {row.status !== "approved" ? (
                <form action={setShopReviewStatus}>
                  <input type="hidden" name="shopReviewId" value={row.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button className={btnSecondary} type="submit">
                    {row.status === "hidden" ? "Restore" : "Approve"}
                  </button>
                </form>
              ) : null}
              {row.status !== "hidden" ? (
                <form action={setShopReviewStatus} className="flex flex-1 flex-wrap items-end gap-2">
                  <input type="hidden" name="shopReviewId" value={row.id} />
                  <input type="hidden" name="status" value="hidden" />
                  <ReasonInput id={`${row.id}-shop-reason`} />
                  <button className={btnDanger} type="submit">
                    Hide
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
