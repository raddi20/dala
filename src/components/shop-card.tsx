import Link from "next/link";
import { cityChipLabel } from "@/lib/constants";
import { CARD_SIZES, cardPhoto } from "@/lib/image-variants";
import { shopIsChecked } from "@/lib/item-card";
import type { ShopCardData } from "@/lib/search";

export function ShopCard({ shop }: { shop: ShopCardData }) {
  const photo = cardPhoto({
    src: shop.coverUrl,
    thumb480: shop.coverThumb480,
    thumb960: shop.coverThumb960,
    width: 480,
    height: 360,
    sizes: CARD_SIZES,
  });
  const avatar = cardPhoto({
    src: shop.avatarUrl,
    width: 80,
    height: 80,
    sizes: "40px",
  });
  const checked = shopIsChecked(shop);
  const place = cityChipLabel(shop.city);
  const meta = [shop.category, place].filter(Boolean).join(" · ");
  const initial = shop.name.trim().charAt(0).toUpperCase() || "S";

  return (
    <article className="card-lift h-full overflow-hidden rounded-[14px] border border-line/80 bg-card shadow-[var(--shadow-card)]">
      <Link href={`/b/${shop.slug}`} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] bg-line">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.src}
              srcSet={photo.srcSet}
              sizes={photo.sizes}
              width={photo.width}
              height={photo.height}
              alt=""
              loading={photo.loading}
              decoding={photo.decoding}
              fetchPriority={photo.fetchPriority}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-end bg-navy p-3 text-white">
              <span className="font-serif text-2xl">{initial}</span>
            </div>
          )}
          <span className="absolute left-2 top-2 inline-flex h-[22px] items-center rounded-full bg-white/90 px-2 text-[11.5px] font-bold text-navy">
            Shop
          </span>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar.src}
              srcSet={avatar.srcSet}
              sizes={avatar.sizes}
              width={40}
              height={40}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute bottom-2 left-2 h-10 w-10 rounded-full border-2 border-white object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col px-2.5 pb-3 pt-2">
          <h2 className="line-clamp-2 font-sans text-[14.5px] font-semibold leading-snug tracking-normal text-ink">{shop.name}</h2>
          {meta ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
              {checked ? (
                <span className="text-ok" aria-label="Checked by Rangach">
                  ✓
                </span>
              ) : null}
              <span className="truncate">{meta}</span>
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
