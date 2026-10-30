/**
 * Listing cards and the listing page share this frame.
 * Both crop with object-cover inside a 4:3 box, so the same file
 * shows the same framing in the grid and on the listing itself.
 * Shop offering tiles use the same class.
 */
export const LISTING_PHOTO_ASPECT = 4 / 3;

export const LISTING_PHOTO_ASPECT_CLASS = "aspect-[4/3]";

/** Intrinsic size hint for the listing page photo. Same 4:3 ratio as the card. */
export const LISTING_DETAIL_PHOTO = { width: 960, height: 720 } as const;
