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

export function telHref(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

export function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  const major = cents / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

export function formatOfferingPrice(priceCents: number | null | undefined, currency: string) {
  if (priceCents == null) return "";
  const major = priceCents / 100;
  const digits = priceCents % 100 === 0 ? 0 : 2;
  const text = major.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  });
  if (currency === "GBP") return `£${text}`;
  if (currency === "KES") return `KES ${text}`;
  return currency ? `${currency} ${text}` : text;
}
