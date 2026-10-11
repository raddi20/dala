import { MAX_IMAGE_BYTES } from "@/lib/image-file";

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
