import { isAllowedListingPhotoUrl } from "@/lib/ai/resize-photo";

const LISTING_ID = /^[a-z0-9]+$/i;

/** Blob URL an admin may store as a listing photo. */
export function listingPhotoTarget(id: string, photoUrl: string): { id: string; photoUrl: string } | null {
  const listingId = id.trim();
  const next = photoUrl.trim();
  if (!LISTING_ID.test(listingId) || listingId.length > 80) return null;
  if (next.length > 2000 || !isAllowedListingPhotoUrl(next)) return null;
  return { id: listingId, photoUrl: next };
}

/**
 * The current listing photo may be read back into the editor by an admin,
 * or by the person who owns that listing. The requested URL must be the one stored.
 */
export function mayReadListingPhoto(input: {
  role: string;
  userId: string;
  ownerId: string | null;
  storedUrl: string;
  requestedUrl: string;
}): boolean {
  if (!input.ownerId) return false;
  const stored = input.storedUrl.trim();
  const requested = input.requestedUrl.trim();
  if (!stored || stored !== requested) return false;
  if (!isAllowedListingPhotoUrl(requested)) return false;
  if (input.role === "admin") return true;
  return input.ownerId === input.userId;
}
