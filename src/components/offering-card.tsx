import { ItemCard } from "@/components/item-card";
import { cityChipLabel } from "@/lib/constants";
import { itemKindTag, shopIsChecked } from "@/lib/item-card";
import type { OfferingCardData } from "@/lib/search";
import { formatOfferingPrice } from "@/lib/utils";

export function OfferingCard({
  offering,
  priority = false,
}: {
  offering: OfferingCardData;
  priority?: boolean;
}) {
  return (
    <ItemCard
      href={`/b/${offering.shopSlug}#offering-${offering.id}`}
      title={offering.title}
      imageUrl={offering.imageUrl}
      tag={itemKindTag({ kind: "offering" })}
      price={formatOfferingPrice(offering.priceCents, offering.currency)}
      seller={offering.shopName}
      place={cityChipLabel(offering.city)}
      checked={shopIsChecked(offering)}
      priority={priority}
    />
  );
}
