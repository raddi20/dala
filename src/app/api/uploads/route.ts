import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { extensionForImageType, MAX_IMAGE_BYTES, validateImagePayload } from "@/lib/image-file";
import { decideUpload, type UploadContext } from "@/lib/image-upload";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISSING_TOKEN =
  "Photo upload is not set up on this site yet. Paste a photo URL instead, or add BLOB_READ_WRITE_TOKEN in Vercel.";

function isUploadFile(value: unknown): value is File {
  if (typeof File !== "undefined" && value instanceof File) return true;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).type === "string"
  );
}

async function contextFor(
  user: { id: string; role: string; verifiedPro: boolean },
  purpose: string,
  resourceId: string,
): Promise<UploadContext> {
  const listing =
    purpose === "listing" && resourceId
      ? await prisma.listing.findUnique({ where: { id: resourceId }, select: { ownerId: true } })
      : null;
  const ownStorefront =
    purpose === "offering" || purpose === "banner"
      ? await prisma.storefront.findUnique({ where: { userId: user.id }, select: { id: true } })
      : null;
  const offeringRow =
    purpose === "offering" && resourceId
      ? await prisma.offering.findUnique({
          where: { id: resourceId },
          select: { storefrontId: true, storefront: { select: { userId: true } } },
        })
      : null;

  return {
    user,
    purpose,
    resourceId,
    listing,
    ownStorefront,
    offering: offeringRow
      ? { storefrontId: offeringRow.storefrontId, ownerUserId: offeringRow.storefront.userId }
      : null,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload a photo." }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json({ error: MISSING_TOKEN }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read that upload." }, { status: 400 });
  }

  const file = form.get("file");
  const purposeField = form.get("purpose");
  const resourceField = form.get("resourceId");
  const purpose = typeof purposeField === "string" ? purposeField : "";
  const resourceId = typeof resourceField === "string" ? resourceField.trim() : "";
  if (!isUploadFile(file)) {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Photo must be 5 MB or smaller." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateImagePayload({
    type: file.type,
    size: bytes.byteLength,
    name: typeof file.name === "string" ? file.name : "",
    bytes,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  let decision: ReturnType<typeof decideUpload>;
  try {
    decision = decideUpload(
      await contextFor(
        { id: user.id, role: user.role, verifiedPro: user.verifiedPro },
        purpose,
        resourceId,
      ),
    );
  } catch {
    console.error("Photo upload auth check failed");
    return NextResponse.json({ error: "Could not check that photo." }, { status: 400 });
  }
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  try {
    const blob = await put(`${decision.pathname}.${extensionForImageType(validated.contentType)}`, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType: validated.contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      maximumSizeInBytes: MAX_IMAGE_BYTES,
    });
    if (!blob.url.startsWith("https://")) {
      return NextResponse.json({ error: "Could not store that photo. Try again." }, { status: 502 });
    }
    return NextResponse.json({ url: blob.url });
  } catch {
    console.error("Photo upload failed");
    return NextResponse.json({ error: "Could not store that photo. Try again." }, { status: 502 });
  }
}
