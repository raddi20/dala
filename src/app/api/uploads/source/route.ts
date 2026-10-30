import { NextResponse } from "next/server";
import { downloadListingPhoto } from "@/lib/ai/resize-photo";
import { sniffImageType } from "@/lib/image-file";
import { mayReadListingPhoto } from "@/lib/listing-photo";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LISTING_ID = /^[a-z0-9]+$/i;

function openPhotoError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "photo-size") return "That photo is too large to reframe.";
  return "Could not open that photo.";
}

/** Same-origin bytes for the photo editor. Blob files are public, but the browser cannot crop a cross-origin image. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to reframe a photo." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listingId")?.trim() ?? "";
  const photoUrl = searchParams.get("url")?.trim() ?? "";
  if (!LISTING_ID.test(listingId) || listingId.length > 80) {
    return NextResponse.json({ error: "That listing photo could not be opened." }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true, photoUrl: true },
  });
  if (
    !mayReadListingPhoto({
      role: user.role,
      userId: user.id,
      ownerId: listing?.ownerId ?? null,
      storedUrl: listing?.photoUrl ?? "",
      requestedUrl: photoUrl,
    })
  ) {
    return NextResponse.json({ error: "That listing photo could not be opened." }, { status: 404 });
  }

  try {
    const bytes = await downloadListingPhoto(photoUrl);
    const type = sniffImageType(bytes);
    if (!type) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo." }, { status: 400 });
    }
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Listing photo could not be opened", error instanceof Error ? error.message : "");
    return NextResponse.json({ error: openPhotoError(error) }, { status: 502 });
  }
}
