import { ItemCard } from "@/components/item-card";
import { cityChipLabel } from "@/lib/constants";
import { variantMap } from "@/lib/image-variant-store";
import { itemKindTag, shopIsChecked } from "@/lib/item-card";
import type { ListingCardData } from "@/lib/search";

export async function ListingCard({
  listing,
  priority = false,
}: {
  listing: ListingCardData;
  priority?: boolean;
}) {
  const shop = listing.owner.storefront;
  const shopPublic = shop != null && shop.published && !shop.hidden;
  const stored = listing.photoUrl ? (await variantMap([listing.photoUrl])).get(listing.photoUrl) : undefined;
  const checked = listing.verified || Boolean(shopPublic && shop && shopIsChecked(shop));

  return (
    <ItemCard
      href={`/listings/${listing.id}`}
      title={listing.title}
      imageUrl={listing.photoUrl}
      thumb480={stored?.thumb480}
      thumb960={stored?.thumb960}
      tag={itemKindTag({ kind: "listing", type: listing.type, category: listing.category })}
      price={listing.priceLabel}
      seller={listing.owner.name}
      place={cityChipLabel(listing.city)}
      checked={checked}
      scamRisk={listing.scamRisk}
      priority={priority}
    />
  );
}
