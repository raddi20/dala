import Link from "next/link";
import { cardClass } from "@/components/ui";
import { regionLabel } from "@/lib/constants";
import type { OfferingCardData } from "@/lib/search";
import { formatOfferingPrice } from "@/lib/utils";

export function OfferingCard({ offering }: { offering: OfferingCardData }) {
  const initial = offering.title.trim().charAt(0).toUpperCase() || "O";
  const price = formatOfferingPrice(offering.priceCents, offering.currency);
  const href = `/b/${offering.shopSlug}#offering-${offering.id}`;
  return (
    <article className={`card-lift flex h-full flex-col overflow-hidden ${cardClass}`}>
      <Link href={href} className="flex flex-1 flex-col">
        {offering.imageUrl ? (
          // User-supplied URLs are arbitrary; next/image would need a remote allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offering.imageUrl} alt="" className="aspect-[16/10] w-full bg-sand object-cover" />
        ) : (
          <div className="flex aspect-[16/10] items-end bg-gradient-to-br from-navy via-navy-soft to-lake-dark p-4 text-white">
            <span className="font-serif text-3xl">{initial}</span>
            {offering.category ? (
              <span className="ml-auto max-w-[60%] text-right text-xs font-medium uppercase tracking-wide text-white/75">
                {offering.category}
              </span>
            ) : null}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink/75 ring-1 ring-sand">
              Offering
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-navy ring-1 ring-sand">
              {regionLabel(offering.region)}
            </span>
          </div>
          <h2 className="font-serif text-xl leading-snug text-navy">{offering.title}</h2>
          <p className="text-sm text-ink/60">{offering.shopName}</p>
          {offering.category ? <p className="text-sm text-ink/60">{offering.category}</p> : null}
          {price ? <p className="text-sm font-semibold text-ink">{price}</p> : null}
        </div>
      </Link>
    </article>
  );
}
