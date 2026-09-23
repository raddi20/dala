export type UploadPurpose = "listing" | "offering" | "banner" | "avatar";

const PURPOSES = new Set<UploadPurpose>(["listing", "offering", "banner", "avatar"]);
const SAFE_ID = /^[a-z0-9]+$/i;

export type UploadUser = { id: string; role: string; verifiedPro: boolean };

export type UploadContext = {
  user: UploadUser;
  purpose: string;
  resourceId: string;
  listing?: { ownerId: string } | null;
  ownStorefront?: { id: string } | null;
  offering?: { storefrontId: string; ownerUserId: string } | null;
};

export function parseUploadPurpose(value: string): UploadPurpose | null {
  return PURPOSES.has(value as UploadPurpose) ? (value as UploadPurpose) : null;
}

function ownerPath(ownerId: string, folder: UploadPurpose): string | null {
  if (!SAFE_ID.test(ownerId)) return null;
  return `users/${ownerId}/${folder}`;
}

export function decideUpload(
  ctx: UploadContext,
): { ok: true; pathname: string } | { ok: false; status: number; error: string } {
  const purpose = parseUploadPurpose(ctx.purpose);
  if (!purpose) return { ok: false, status: 400, error: "Choose what this photo is for." };
  if (ctx.resourceId.length > 80 || (ctx.resourceId !== "" && !SAFE_ID.test(ctx.resourceId))) {
    return { ok: false, status: 400, error: "That photo target is not valid." };
  }

  if (purpose === "avatar") {
    const pathname = ownerPath(ctx.user.id, "avatar");
    if (!pathname) return { ok: false, status: 400, error: "Could not store that photo." };
    return { ok: true, pathname };
  }

  if (purpose === "listing") {
    if (!ctx.resourceId) {
      const pathname = ownerPath(ctx.user.id, "listing");
      if (!pathname) return { ok: false, status: 400, error: "Could not store that photo." };
      return { ok: true, pathname };
    }
    if (!ctx.listing) return { ok: false, status: 404, error: "Listing not found." };
    if (ctx.listing.ownerId !== ctx.user.id && ctx.user.role !== "admin") {
      return { ok: false, status: 403, error: "You can only upload photos for your own listing." };
    }
    const pathname = ownerPath(ctx.listing.ownerId, "listing");
    if (!pathname) return { ok: false, status: 400, error: "Could not store that photo." };
    return { ok: true, pathname };
  }

  if (purpose === "offering") {
    if (!ctx.resourceId) {
      if (!ctx.ownStorefront) {
        return { ok: false, status: 403, error: "Start your shop before uploading an offering photo." };
      }
      const pathname = ownerPath(ctx.user.id, "offering");
      if (!pathname) return { ok: false, status: 400, error: "Could not store that photo." };
      return { ok: true, pathname };
    }
    if (!ctx.offering) return { ok: false, status: 404, error: "Offering not found." };
    const owns = Boolean(ctx.ownStorefront && ctx.offering.storefrontId === ctx.ownStorefront.id);
    if (!owns && ctx.user.role !== "admin") {
      return { ok: false, status: 403, error: "You can only upload photos for your own shop." };
    }
    const pathname = ownerPath(ctx.offering.ownerUserId, "offering");
    if (!pathname) return { ok: false, status: 400, error: "Could not store that photo." };
    return { ok: true, pathname };
  }

  if (!ctx.ownStorefront) {
    return { ok: false, status: 403, error: "Start your shop before uploading a cover photo." };
  }
  if (!ctx.user.verifiedPro && ctx.user.role !== "admin") {
    return { ok: false, status: 403, error: "A cover photo is included with Verified Pro." };
  }
  const pathname = ownerPath(ctx.user.id, "banner");
  if (!pathname) return { ok: false, status: 400, error: "Could not store that photo." };
  return { ok: true, pathname };
}
