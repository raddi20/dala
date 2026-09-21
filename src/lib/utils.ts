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
