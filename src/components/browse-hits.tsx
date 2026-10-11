import { ListingCard } from "@/components/listing-card";
import { OfferingCard } from "@/components/offering-card";
import { ShopCard } from "@/components/shop-card";
import type { CatalogueHit } from "@/lib/search";

export function BrowseHits({ hits }: { hits: CatalogueHit[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {hits.map((hit) => {
        if (hit.kind === "listing") return <ListingCard key={`listing-${hit.listing.id}`} listing={hit.listing} />;
        if (hit.kind === "shop") return <ShopCard key={`shop-${hit.shop.id}`} shop={hit.shop} />;
        return <OfferingCard key={`offering-${hit.offering.id}`} offering={hit.offering} />;
      })}
    </div>
  );
}
