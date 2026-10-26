export function one(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function safePath(input: string, fallback = "/") {
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\") || input.includes("\n")) {
    return fallback;
  }
  return input;
}

/** Keep a same-site return path on a link. "/" stays as the bare path. */
export function withNext(path: string, next: string) {
  const dest = safePath(next, "/");
  if (dest === "/") return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}next=${encodeURIComponent(dest)}`;
}

/** Signed-out seller links go through sign-in and return to the same page. */
export function continueHref(signedIn: boolean, path: string) {
  if (signedIn) return path;
  return `/login?next=${encodeURIComponent(path)}`;
}

export function authContinueCopy(next: string, mode: "login" | "register" = "login") {
  const start = mode === "register" ? "Create an account" : "Sign in";
  if (next.startsWith("/account/storefront")) {
    return `${start} to open your shop. We continue to shop setup after that.`;
  }
  if (next.startsWith("/listings/new")) {
    return `${start} to list your business. We continue to the listing form after that.`;
  }
  return "";
}

export function averageRating(reviews: { rating: number }[]) {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return total / reviews.length;
}

export function isFeatured(listing: { featured: boolean; featuredUntil: Date | null }) {
  if (!listing.featured) return false;
  if (!listing.featuredUntil) return true;
  return listing.featuredUntil.getTime() > Date.now();
}

export function formatWhen(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export { telHref } from "@/lib/phone";

function centsText(cents: number) {
  const major = cents / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

export function centsToInput(cents: number | null | undefined, maxCents?: number | null) {
  if (cents == null) return "";
  return maxCents != null ? `${centsText(cents)} – ${centsText(maxCents)}` : centsText(cents);
}

function majorText(cents: number) {
  const digits = cents % 100 === 0 ? 0 : 2;
  return (cents / 100).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
}

export function formatOfferingPrice(
  priceCents: number | null | undefined,
  currency: string,
  priceMaxCents?: number | null,
) {
  if (priceCents == null) return "";
  if (priceMaxCents != null && priceMaxCents > priceCents) {
    const low = majorText(priceCents);
    const high = majorText(priceMaxCents);
    if (currency === "GBP") return `£${low} – £${high}`;
    if (currency === "KES") return `KSh ${low} – ${high}`;
    return currency ? `${currency} ${low} – ${high}` : `${low} – ${high}`;
  }
  const text = majorText(priceCents);
  if (currency === "GBP") return `£${text}`;
  if (currency === "KES") return `KES ${text}`;
  return currency ? `${currency} ${text}` : text;
}
