import Link from "next/link";
import { shownPriceLabel } from "@/lib/crawl-copy";

export function ListingLinkList({
  listings,
}: {
  listings: { id: string; title: string; priceLabel?: string | null }[];
}) {
  if (listings.length === 0) return null;
  return (
    <ul className="grid gap-1 text-sm">
      {listings.map((listing) => {
        const price = shownPriceLabel(listing.priceLabel ?? "");
        return (
          <li key={listing.id}>
            <Link href={`/listings/${encodeURIComponent(listing.id)}`} className="font-semibold text-gold-d">
              {listing.title}
            </Link>
            {price ? <span className="text-ink/70"> · {price}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
