import Link from "next/link";
import { SaveHeart } from "@/components/save-heart";
import { CARD_SIZES, cardPhoto } from "@/lib/image-variants";
import { itemPriceText, showScamChip } from "@/lib/item-card";
import { LISTING_PHOTO_ASPECT_CLASS } from "@/lib/listing-photo-frame";

export function ItemCard({
  href,
  title,
  imageUrl,
  thumb480,
  thumb960,
  tag,
  price,
  seller,
  place,
  checked,
  scamRisk,
  priority = false,
  lite = false,
  saveId,
}: {
  href: string;
  title: string;
  imageUrl: string;
  thumb480?: string | null;
  thumb960?: string | null;
  tag: string;
  price?: string | null;
  seller: string;
  place: string;
  checked?: boolean;
  scamRisk?: string | null;
  priority?: boolean;
  lite?: boolean;
  /** Listing id. Shows the Saved heart. */
  saveId?: string;
}) {
  const photo = cardPhoto({
    src: imageUrl,
    thumb480,
    thumb960,
    width: 480,
    height: 360,
    sizes: CARD_SIZES,
    priority,
    lite,
  });
  const amount = itemPriceText(price);
  const meta = [seller, place].filter(Boolean).join(" · ");
  const warn = showScamChip(scamRisk);

  return (
    <article className="card-lift relative h-full overflow-hidden rounded-[14px] border border-line/80 bg-card shadow-[var(--shadow-card)]">
      <Link href={href} className="flex h-full flex-col">
        <div className={`relative ${LISTING_PHOTO_ASPECT_CLASS} bg-line`}>
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
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-end bg-navy p-3 text-white">
              <span className="font-serif text-2xl">{title.trim().charAt(0).toUpperCase() || "R"}</span>
            </div>
          )}
          <span className="absolute left-2 top-2 inline-flex h-[22px] items-center rounded-full bg-white/90 px-2 text-[11.5px] font-bold text-navy">
            {tag}
          </span>
          {warn ? (
            <span className="absolute bottom-2 left-2 inline-flex h-[22px] items-center rounded-full bg-amber-soft px-2 text-[11px] font-bold text-warn">
              Check details
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col px-2.5 pb-3 pt-2">
          <h2 className="line-clamp-2 font-sans text-[14.5px] font-semibold leading-snug tracking-normal text-ink">{title}</h2>
          <p className={`mt-0.5 text-[14.5px] ${amount.ask ? "text-[13px] font-semibold text-muted" : "font-extrabold text-navy"}`}>
            {amount.text}
          </p>
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
      {saveId ? <SaveHeart item={{ id: saveId, title, photo: photo?.src ?? "", price: price ?? "", place }} /> : null}
    </article>
  );
}
