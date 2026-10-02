import Link from "next/link";
import { Badges, CityBadge } from "@/components/badges";
import { VideoMark } from "@/components/video-mark";
import { FamilyOrderButton } from "@/components/family-order-button";
import { cardClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import type { ListingCardData } from "@/lib/search";
import { averageRating } from "@/lib/utils";

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const rating = averageRating(listing.reviews);
  const initial = listing.title.trim().charAt(0).toUpperCase() || "D";
  const shopSlug = listing.owner.storefront?.published ? listing.owner.storefront.slug : "";
  const whatsapp = listing.contactWhatsapp.trim();
  const servesDiaspora = Boolean(listing.owner.storefront?.servesDiaspora);
  const hasVideo = Boolean(
    listing.owner.verifiedPro && listing.owner.storefront?.published && (listing.owner.storefront.videos?.length ?? 0) > 0,
  );

  return (
    <article className={`card-lift flex h-full flex-col overflow-hidden ${cardClass}`}>
      <Link href={`/listings/${listing.id}`} className="flex flex-1 flex-col">
        <div className="relative">
          {listing.photoUrl ? (
            // User-supplied URLs are arbitrary; next/image would need a remote allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.photoUrl} alt="" className="aspect-[16/10] w-full bg-sand object-cover" />
          ) : (
            <div className="flex aspect-[16/10] w-full items-end bg-gradient-to-br from-navy via-navy-soft to-lake-dark p-4 text-white">
              <span className="font-serif text-3xl">{initial}</span>
              <span className="ml-auto max-w-[60%] text-right text-xs font-medium uppercase tracking-wide text-white/75">
                {listing.category}
              </span>
            </div>
          )}
          <div className="absolute left-3 top-3">
            <CityBadge city={listing.city} />
          </div>
          {hasVideo ? (
            <div className="absolute bottom-3 left-3">
              <VideoMark />
            </div>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <Badges
            type={listing.type}
            verified={listing.verified}
            verifiedPro={listing.owner.verifiedPro}
            shopBadges={listing.owner.storefront}
            servesDiaspora={servesDiaspora}
            featured={listing.featured}
            featuredUntil={listing.featuredUntil}
            scamRisk={listing.scamRisk}
          />
          <h2 className="font-serif text-xl leading-snug text-navy">{listing.title}</h2>
          <p className="text-sm text-ink/60">{listing.category}</p>
          {listing.priceLabel ? <p className="text-sm font-semibold text-ink">{listing.priceLabel}</p> : null}
          <p className="mt-auto text-sm text-ink/55">
            {rating === null ? "No reviews yet" : `${rating.toFixed(1)} ★ · ${listing.reviews.length}`}
          </p>
        </div>
      </Link>
      {shopSlug || whatsapp ? (
        <div className="grid gap-2 border-t border-sand/80 px-4 py-3">
          {shopSlug ? (
            <Link href={`/b/${shopSlug}`} className="text-sm font-semibold text-lake-dark hover:text-lake">
              Visit shop →
            </Link>
          ) : null}
          {whatsapp ? (
            <FamilyOrderButton
              phone={whatsapp}
              subjectName={listing.title}
              path={`/listings/${listing.id}`}
              siteName={appName()}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
