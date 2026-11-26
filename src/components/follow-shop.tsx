import { toggleShopFollow } from "@/lib/actions/community";
import { FOLLOW_ERRORS, type FollowCode } from "@/lib/community/follow";

const pageClass = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-semibold";
const cardClass = "inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-semibold shadow-sm";

export function followNotice(code: string): string {
  if (code in FOLLOW_ERRORS) return FOLLOW_ERRORS[code as FollowCode];
  return "";
}

/** Follow control. Signed-out people go to sign in and come back already following. */
export function FollowShop({
  shopId,
  slug,
  name,
  following,
  signedIn,
  followable,
  returnTo,
  variant = "page",
  tone = "default",
}: {
  shopId: string;
  slug: string;
  name: string;
  following: boolean;
  signedIn: boolean;
  followable: boolean;
  returnTo: string;
  variant?: "page" | "card";
  /** On a photo, gold and white stay readable. Navy-on-navy would disappear. */
  tone?: "default" | "onPhoto";
}) {
  if (!followable) return null;
  const label = following ? `Following ${name}` : `Follow ${name}`;
  const look = following
    ? tone === "onPhoto"
      ? "border-gold bg-gold text-navy"
      : "border-navy bg-navy text-white"
    : tone === "onPhoto"
      ? "border-white bg-white text-navy"
      : "border-gold/40 bg-white text-navy hover:border-gold";
  const className = `${variant === "card" ? cardClass : pageClass} ${look}`;
  const place = variant === "card" ? "absolute right-1.5 top-1.5 z-10" : "";
  if (!signedIn) {
    const back = `/b/${slug}`;
    const apply = `/api/community/follow?shop=${encodeURIComponent(shopId)}&next=${encodeURIComponent(back)}`;
    return (
      <a href={`/login?next=${encodeURIComponent(apply)}`} data-follow-shop="" aria-label={label} className={`${place} ${className}`}>
        Follow
      </a>
    );
  }
  return (
    <form action={toggleShopFollow} className={place}>
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" aria-pressed={following} aria-label={label} data-follow-shop="" className={className}>
        {following ? "Following" : "Follow"}
      </button>
    </form>
  );
}
