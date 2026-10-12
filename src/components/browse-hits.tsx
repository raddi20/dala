import { ListingCard } from "@/components/listing-card";
import { OccasionNeeds } from "@/components/results-chrome";
import { OfferingCard } from "@/components/offering-card";
import { ShopResultRow } from "@/components/shop-result-row";
import type { CatalogueHit } from "@/lib/search";

type ItemHitData = Exclude<CatalogueHit, { kind: "shop" }>;

function isItem(hit: CatalogueHit): hit is ItemHitData {
  return hit.kind !== "shop";
}

function ItemHit({ hit }: { hit: ItemHitData }) {
  if (hit.kind === "listing") return <ListingCard listing={hit.listing} />;
  return <OfferingCard offering={hit.offering} />;
}

export function BrowseHits({
  hits,
  origin,
  occasionSlug = "",
}: {
  hits: CatalogueHit[];
  origin: string;
  occasionSlug?: string;
}) {
  const shops = hits.filter((hit) => hit.kind === "shop");
  const items = hits.filter(isItem);
  const lead = items.slice(0, 2);
  const rest = items.slice(2);

  return (
    <div className="grid gap-4">
      {shops.length > 0 ? (
        <ul className="grid gap-2">
          {shops.map((hit) =>
            hit.kind === "shop" ? <ShopResultRow key={`shop-${hit.shop.id}`} shop={hit.shop} origin={origin} /> : null,
          )}
        </ul>
      ) : null}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {lead.map((hit) => (
            <ItemHit key={hit.kind === "listing" ? `listing-${hit.listing.id}` : `offering-${hit.offering.id}`} hit={hit} />
          ))}
          {occasionSlug ? (
            <div className="col-span-2">
              <OccasionNeeds slug={occasionSlug} />
            </div>
          ) : null}
          {rest.map((hit) => (
            <ItemHit key={hit.kind === "listing" ? `listing-${hit.listing.id}` : `offering-${hit.offering.id}`} hit={hit} />
          ))}
        </div>
      ) : occasionSlug ? (
        <OccasionNeeds slug={occasionSlug} />
      ) : null}
    </div>
  );
}
