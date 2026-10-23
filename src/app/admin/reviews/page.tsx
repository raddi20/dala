import type { Metadata } from "next";
import Link from "next/link";
import { ReasonInput } from "@/components/admin-reason";
import { AdminShopReviews } from "@/components/admin-shop-reviews";
import { btnDanger, btnSecondary } from "@/components/ui";
import { setReviewHidden } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      author: { select: { name: true, email: true } },
      listing: { select: { id: true, title: true } },
    },
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <AdminShopReviews />

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Reviews</h2>
        <p className="text-sm text-ink/70">The latest reviews. Hiding one removes it from the listing, the shop, and the rating.</p>
        {reviews.length === 0 ? <p className="text-sm text-ink/70">No reviews.</p> : null}
        {reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <p className="font-semibold">
              {review.rating} / 5 · {review.author.name} · {review.hidden ? "Hidden" : "Visible"}
            </p>
            <p className="text-ink/70">
              {review.author.email} · {formatWhen(review.createdAt)}
              {review.listing ? (
                <>
                  {" · "}
                  <Link href={`/listings/${review.listing.id}`} className="font-semibold text-lake-dark">
                    {review.listing.title}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{review.body}</p>
            {review.hiddenReason ? <p className="mt-1 text-ink/70">{review.hiddenReason}</p> : null}
            <form action={setReviewHidden} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="hidden" value={review.hidden ? "0" : "1"} />
              <ReasonInput id={`${review.id}-reason`} />
              <button className={review.hidden ? btnSecondary : btnDanger} type="submit">
                {review.hidden ? "Restore review" : "Hide review"}
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
