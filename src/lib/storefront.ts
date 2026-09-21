import { prisma } from "@/lib/prisma";
import { isFeatured } from "@/lib/utils";

export function slugifyShopName(input: string) {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "shop";
}

export async function uniqueSlug(name: string, exceptId?: string) {
  const root = slugifyShopName(name);
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const existing = await prisma.storefront.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === exceptId) return candidate;
  }
  throw new Error("Could not choose a shop address.");
}

export async function shopSignals(ownerId: string) {
  const listings = await prisma.listing.findMany({
    where: { ownerId, hidden: false },
    select: {
      id: true,
      title: true,
      category: true,
      type: true,
      address: true,
      verified: true,
      featured: true,
      featuredUntil: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const business = listings.filter((listing) => listing.type === "business");
  const pool = business.length > 0 ? business : listings;
  const primary =
    pool.find((listing) => listing.verified && isFeatured(listing)) ??
    pool.find((listing) => listing.verified) ??
    pool.find((listing) => isFeatured(listing)) ??
    pool[0] ??
    null;

  return {
    verified: listings.some((listing) => listing.verified),
    category: primary?.category ?? "",
    address: primary?.address ?? "",
    listingId: primary?.id ?? "",
    listingTitle: primary?.title ?? "",
  };
}

export async function shopReviews(ownerId: string) {
  return prisma.review.findMany({
    where: { hidden: false, listing: { ownerId, hidden: false } },
    include: {
      author: { select: { id: true, name: true } },
      listing: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
