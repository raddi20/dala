import Link from "next/link";
import { Badges } from "@/components/badges";
import type { ListingCardData } from "@/lib/search";
import { averageRating } from "@/lib/utils";

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const rating = averageRating(listing.reviews);
  const initial = listing.title.trim().charAt(0).toUpperCase() || "D";
  const shopSlug = listing.owner.storefront?.published ? listing.owner.storefront.slug : "";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-sand bg-card shadow-sm">
      <Link href={`/listings/${listing.id}`} className="flex flex-1 flex-col">
        {listing.photoUrl ? (
          // User-supplied URLs are arbitrary; next/image would need a remote allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photoUrl} alt="" className="aspect-video w-full bg-sand object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-end bg-lake-dark p-3 text-white">
            <span className="font-serif text-3xl">{initial}</span>
            <span className="ml-auto max-w-[60%] text-right text-xs uppercase tracking-wide text-white/80">
              {listing.category}
            </span>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <Badges
            type={listing.type}
            verified={listing.verified}
            verifiedPro={listing.owner.verifiedPro}
            featured={listing.featured}
            featuredUntil={listing.featuredUntil}
            scamRisk={listing.scamRisk}
          />
          <h2 className="font-serif text-xl leading-snug">{listing.title}</h2>
          <p className="text-sm text-ink/70">
            {listing.city} · {listing.category}
          </p>
          {listing.priceLabel ? <p className="text-sm font-semibold">{listing.priceLabel}</p> : null}
          <p className="mt-auto text-sm text-ink/70">
            {rating === null ? "No reviews yet" : `${rating.toFixed(1)} ★ · ${listing.reviews.length}`}
          </p>
        </div>
      </Link>
      {shopSlug ? (
        <div className="border-t border-sand px-4 py-2.5">
          <Link href={`/b/${shopSlug}`} className="text-sm font-semibold text-lake-dark">
            Shop
          </Link>
        </div>
      ) : null}
    </article>
  );
}
