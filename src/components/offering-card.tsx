import { ItemCard } from "@/components/item-card";
import { cityChipLabel } from "@/lib/constants";
import { variantMap } from "@/lib/image-variant-store";
import { itemKindTag, shopIsChecked } from "@/lib/item-card";
import type { OfferingCardData } from "@/lib/search";
import { formatOfferingPrice } from "@/lib/utils";

export async function OfferingCard({
  offering,
  priority = false,
}: {
  offering: OfferingCardData;
  priority?: boolean;
}) {
  const stored = offering.imageUrl ? (await variantMap([offering.imageUrl])).get(offering.imageUrl) : undefined;
  return (
    <ItemCard
      href={`/b/${offering.shopSlug}#offering-${offering.id}`}
      title={offering.title}
      imageUrl={offering.imageUrl}
      thumb480={stored?.thumb480}
      thumb960={stored?.thumb960}
      tag={itemKindTag({ kind: "offering" })}
      price={formatOfferingPrice(offering.priceCents, offering.currency)}
      seller={offering.shopName}
      place={cityChipLabel(offering.city)}
      checked={shopIsChecked(offering)}
      priority={priority}
    />
  );
}
