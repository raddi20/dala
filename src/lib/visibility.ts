import type { Prisma } from "@prisma/client";

export type PublicViewer = { id: string; role: string } | null;

/** Owner filter shared by browse, search, sitemap, and counts. */
export const liveOwner: Prisma.UserWhereInput = { suspended: false };

export const publicReviewWhere: Prisma.ReviewWhereInput = {
  hidden: false,
  author: { suspended: false },
};

export function isPublicListing(listing: { hidden: boolean; ownerSuspended: boolean }): boolean {
  return !listing.hidden && !listing.ownerSuspended;
}

export function isPublicShop(shop: { published: boolean; hidden: boolean; ownerSuspended: boolean }): boolean {
  return shop.published && !shop.hidden && !shop.ownerSuspended;
}

export function isPublicOffering(offering: {
  archived: boolean;
  hidden: boolean;
  shopPublished: boolean;
  shopHidden: boolean;
  ownerSuspended: boolean;
}): boolean {
  return (
    !offering.archived &&
    !offering.hidden &&
    offering.shopPublished &&
    !offering.shopHidden &&
    !offering.ownerSuspended
  );
}

export function isPublicReview(review: {
  hidden: boolean;
  authorSuspended: boolean;
  listingHidden: boolean;
  ownerSuspended: boolean;
}): boolean {
  return !review.hidden && !review.authorSuspended && !review.listingHidden && !review.ownerSuspended;
}

/** Buyers, the owner, and admins. A suspended owner cannot open their own pages. */
export function listingOpenTo(
  viewer: PublicViewer,
  listing: { hidden: boolean; ownerId: string; ownerSuspended: boolean },
): boolean {
  if (isPublicListing(listing)) return true;
  if (!viewer || listing.ownerSuspended) return viewer?.role === "admin";
  if (viewer.role === "admin") return true;
  return viewer.id === listing.ownerId;
}

export function shopOpenTo(
  viewer: PublicViewer,
  shop: { published: boolean; hidden: boolean; ownerId: string; ownerSuspended: boolean },
): boolean {
  if (shop.ownerSuspended) return viewer?.role === "admin";
  if (isPublicShop(shop)) return true;
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  return viewer.id === shop.ownerId;
}

export function profileOpenTo(viewer: PublicViewer, person: { suspended: boolean }): boolean {
  if (!person.suspended) return true;
  return viewer?.role === "admin";
}
