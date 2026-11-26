import Link from "next/link";
import { FollowShop } from "@/components/follow-shop";
import { cardClass } from "@/components/ui";

export function FollowedShops({
  shops,
  returnTo,
}: {
  shops: { id: string; slug: string; name: string; city: string }[];
  returnTo: string;
}) {
  return (
    <section data-followed-shops="" className="grid min-w-0 gap-3">
      <h2 className="font-serif text-2xl text-navy">Shops you follow</h2>
      {shops.length === 0 ? (
        <p className="text-sm text-ink/70">
          When you follow a shop, it waits here. A Monday note arrives only when that shop has something new.
        </p>
      ) : (
        <ul className="grid gap-2">
          {shops.map((shop) => (
            <li key={shop.id} className={`${cardClass} flex min-w-0 items-center justify-between gap-3 p-3`}>
              <Link href={`/b/${shop.slug}`} className="min-w-0">
                <span className="block truncate font-semibold text-navy">{shop.name}</span>
                {shop.city ? <span className="block truncate text-sm text-muted">{shop.city}</span> : null}
              </Link>
              <FollowShop
                shopId={shop.id}
                slug={shop.slug}
                name={shop.name}
                following
                signedIn
                followable
                returnTo={returnTo}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
