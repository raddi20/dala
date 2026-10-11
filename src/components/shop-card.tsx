import Link from "next/link";
import { ShopBadgeChips } from "@/components/badges";
import { cardClass } from "@/components/ui";
import { regionLabel } from "@/lib/constants";
import type { ShopCardData } from "@/lib/search";

export function ShopCard({ shop }: { shop: ShopCardData }) {
  const initial = shop.name.trim().charAt(0).toUpperCase() || "S";
  return (
    <article className={`card-lift flex h-full flex-col overflow-hidden ${cardClass}`}>
      <Link href={`/b/${shop.slug}`} className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex aspect-[16/10] items-end rounded-xl bg-gradient-to-br from-navy via-navy-soft to-lake-dark p-4 text-white">
          <span className="font-serif text-3xl">{initial}</span>
          {shop.category ? (
            <span className="ml-auto max-w-[60%] text-right text-xs font-medium uppercase tracking-wide text-white/75">
              {shop.category}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink/75 ring-1 ring-sand">
            Shop
          </span>
          <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-navy ring-1 ring-sand">
            {regionLabel(shop.region)}
          </span>
          {shop.verified ? (
            <span className="inline-flex items-center rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-lake-dark ring-1 ring-lake/20">
              Verified
            </span>
          ) : null}
          <ShopBadgeChips
            flags={{
              phoneVerified: shop.phoneVerified,
              locationVerified: shop.locationVerified,
              businessVerified: shop.businessVerified,
            }}
          />
        </div>
        <h2 className="font-serif text-xl leading-snug text-navy">{shop.name}</h2>
        {shop.category ? <p className="text-sm text-ink/60">{shop.category}</p> : null}
        <p className="mt-auto text-sm font-semibold text-lake-dark">Visit shop →</p>
      </Link>
    </article>
  );
}
