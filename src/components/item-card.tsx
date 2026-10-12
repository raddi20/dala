import Link from "next/link";
import { itemPriceText, showScamChip } from "@/lib/item-card";

export function ItemCard({
  href,
  title,
  imageUrl,
  tag,
  price,
  seller,
  place,
  checked,
  scamRisk,
  priority = false,
}: {
  href: string;
  title: string;
  imageUrl: string;
  tag: string;
  price?: string | null;
  seller: string;
  place: string;
  checked?: boolean;
  scamRisk?: string | null;
  priority?: boolean;
}) {
  const src = imageUrl.trim();
  const amount = itemPriceText(price);
  const meta = [seller, place].filter(Boolean).join(" · ");
  const warn = showScamChip(scamRisk);

  return (
    <article className="card-lift h-full overflow-hidden rounded-[14px] border border-line/80 bg-card shadow-[var(--shadow-card)]">
      <Link href={href} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] bg-line">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              width={480}
              height={360}
              alt=""
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              className="h-full w-full object-cover"
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
    </article>
  );
}
