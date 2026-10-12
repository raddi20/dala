import Link from "next/link";
import { cityChipLabel } from "@/lib/constants";
import { cardPhoto } from "@/lib/image-variants";
import { shopIsChecked } from "@/lib/item-card";
import type { ShopCardData } from "@/lib/search";
import { whatsappShopLink } from "@/lib/whatsapp";

export function ShopResultRow({ shop, origin }: { shop: ShopCardData; origin: string }) {
  const avatar = cardPhoto({
    src: shop.avatarUrl,
    width: 80,
    height: 80,
    sizes: "44px",
  });
  const checked = shopIsChecked(shop);
  const place = cityChipLabel(shop.city);
  const meta = [shop.category, place].filter(Boolean).join(" · ");
  const initial = shop.name.trim().charAt(0).toUpperCase() || "S";
  const chat = shop.whatsapp ? whatsappShopLink(shop.whatsapp, `${origin}/b/${shop.slug}`) : "";

  return (
    <li className="flex items-center gap-2 rounded-[14px] border border-line/80 bg-card px-2.5 py-2 shadow-[var(--shadow-card)]">
      <Link href={`/b/${shop.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar.src}
            srcSet={avatar.srcSet}
            sizes={avatar.sizes}
            width={44}
            height={44}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy font-serif text-lg text-white">
            {initial}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-ink">{shop.name}</span>
          {meta ? (
            <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-muted">
              {checked ? (
                <span className="text-ok" aria-label="Checked by Rangach">
                  ✓
                </span>
              ) : null}
              <span className="truncate">{meta}</span>
            </span>
          ) : null}
        </span>
      </Link>
      {chat ? (
        <a
          href={chat}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${shop.name}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa text-white hover:bg-wa-d"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M12.04 3C7.31 3 3.47 6.84 3.47 11.57c0 1.5.39 2.96 1.14 4.25L3 21l5.32-1.56a8.54 8.54 0 0 0 3.72.84h.01c4.73 0 8.57-3.84 8.57-8.57C20.62 6.84 16.77 3 12.04 3zm4.9 12.16c-.2.57-1.17 1.05-1.63 1.12-.42.06-.96.09-1.55-.1-.36-.11-.82-.27-1.41-.53-2.48-1.07-4.1-3.57-4.22-3.74-.12-.16-1-1.33-1-2.54 0-1.2.63-1.8.86-2.04.22-.24.49-.3.65-.3h.47c.15 0 .35-.06.55.42.2.48.69 1.66.75 1.78.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.24.24-.1.47.14.24.62 1.02 1.33 1.66.92.82 1.69 1.07 1.93 1.19.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.14 1.15z" />
          </svg>
        </a>
      ) : null}
    </li>
  );
}
