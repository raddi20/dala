"use server";

import { revalidatePath } from "next/cache";
import { scheduleListingModeration } from "@/lib/ai/moderation";
import { downloadListingPhoto } from "@/lib/ai/resize-photo";
import { storeImageVariants } from "@/lib/image-variant-store";
import { isVariantComplete } from "@/lib/image-variants";
import { listingPhotoTarget } from "@/lib/listing-photo";
import { auditData } from "@/lib/moderation";
import { OCCASION_DEFINITIONS } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function refreshListingPhoto(id: string, ownerId: string) {
  revalidatePath("/");
  revalidatePath("/listings");
  revalidatePath(`/listings/${id}`);
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/occasions");
  revalidatePath("/categories");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/people/${ownerId}`);
  for (const item of OCCASION_DEFINITIONS) revalidatePath(`/occasions/${item.slug}`);
}

/** Fill 480 and 960 thumbs when the upload did not finish writing them. */
async function ensureListingPhotoVariants(sourceUrl: string) {
  const current = await prisma.imageVariant.findUnique({
    where: { sourceUrl },
    select: { thumb480: true, thumb960: true, longest: true },
  });
  if (isVariantComplete(current)) return;
  const bytes = Buffer.from(await downloadListingPhoto(sourceUrl));
  await storeImageVariants(sourceUrl, bytes);
}

export async function replaceListingPhoto(
  listingId: string,
  photoUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin("/admin/listings");
  const target = listingPhotoTarget(listingId, photoUrl);
  if (!target) return { ok: false, error: "That photo could not be saved." };

  const listing = await prisma.listing.findUnique({
    where: { id: target.id },
    select: { id: true, photoUrl: true, ownerId: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.photoUrl === target.photoUrl) return { ok: true };

  try {
    await ensureListingPhotoVariants(target.photoUrl);
  } catch {
    return { ok: false, error: "The smaller copies of that photo could not be saved. Try again." };
  }

  await prisma.$transaction([
    prisma.listing.update({ where: { id: listing.id }, data: { photoUrl: target.photoUrl } }),
    prisma.adminAuditLog.create({
      data: auditData(
        { id: admin.id, email: admin.email, name: admin.name },
        "listing.reframe",
        "listing",
        listing.id,
        "Reframe listing photo",
      ),
    }),
  ]);

  refreshListingPhoto(listing.id, listing.ownerId);
  scheduleListingModeration(listing.id);
  return { ok: true };
}
