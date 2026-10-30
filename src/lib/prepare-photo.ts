import { extensionForImageType, MAX_IMAGE_BYTES, normalizeImageType, sniffImageType } from "@/lib/image-file";

export async function uploadPhoto(file: File, purpose: string, resourceId?: string): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That photo is still too large after compressing. Try a different one.");
  }
  const body = new FormData();
  body.set("file", file);
  body.set("purpose", purpose);
  if (resourceId) body.set("resourceId", resourceId);

  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", body });
  } catch {
    throw new Error("Could not reach photo upload. Check your connection and try again.");
  }

  let payload: { url?: unknown; error?: unknown } = {};
  try {
    payload = (await response.json()) as { url?: unknown; error?: unknown };
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" && payload.error ? payload.error : "Could not upload that photo. Try again.");
  }
  if (typeof payload.url !== "string" || !/^https:\/\//i.test(payload.url)) {
    throw new Error("Upload did not return a photo address.");
  }
  return payload.url;
}

/** Load the stored listing photo so the existing editor can crop it. */
export async function fileFromListingPhoto(listingId: string, url: string): Promise<File> {
  const endpoint = `/api/uploads/source?listingId=${encodeURIComponent(listingId)}&url=${encodeURIComponent(url)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { cache: "no-store" });
  } catch {
    throw new Error("Could not open that photo. Check your connection and try again.");
  }

  if (!response.ok) {
    let message = "Could not open that photo.";
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error) message = payload.error;
    } catch {
      message = "Could not open that photo.";
    }
    throw new Error(message);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = sniffImageType(bytes) ?? normalizeImageType(response.headers.get("content-type") ?? "");
  if (!type) throw new Error("Use a JPEG, PNG, or WebP photo.");
  return new File([bytes], `listing.${extensionForImageType(type)}`, { type });
}
