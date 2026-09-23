import { clientImageChoiceError, MAX_IMAGE_BYTES, normalizeImageType, imageTypeFromName } from "@/lib/image-file";

const MAX_EDGE = 1600;
const COMFORTABLE_BYTES = Math.floor(1.5 * 1024 * 1024);
const SEND_LIMIT = 4 * 1024 * 1024;

type Decoded = {
  width: number;
  height: number;
  source: CanvasImageSource;
  cleanup: () => void;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that photo. Use a JPEG, PNG, or WebP."));
    img.src = src;
  });
}

async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Some mobile browsers reject createImageBitmap for a photo Image() can still draw.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export async function preparePhoto(file: File): Promise<File> {
  const choice = clientImageChoiceError(file);
  if (choice) throw new Error(choice);

  const decoded = await decodeImage(file);
  try {
    if (decoded.width < 1 || decoded.height < 1) {
      throw new Error("Could not read that photo. Use a JPEG, PNG, or WebP.");
    }
    const longest = Math.max(decoded.width, decoded.height);
    const type = normalizeImageType(file.type) ?? imageTypeFromName(file.name);
    if (longest <= MAX_EDGE && file.size <= COMFORTABLE_BYTES && file.size <= MAX_IMAGE_BYTES && type) {
      return file;
    }

    const scale = Math.min(1, MAX_EDGE / longest);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare that photo on this device.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let quality = 0.82;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= SEND_LIMIT && (blob.size <= COMFORTABLE_BYTES || quality <= 0.5)) break;
      if (quality <= 0.5) break;
      quality = Math.max(0.5, quality - 0.1);
    }
    if (!blob) throw new Error("Could not prepare that photo on this device.");
    if (blob.size > SEND_LIMIT || blob.size > MAX_IMAGE_BYTES) {
      throw new Error("That photo is still too large after compressing. Try a different one.");
    }
    return new File([blob], "photo.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    decoded.cleanup();
  }
}

export async function uploadPhoto(file: File, purpose: string, resourceId?: string): Promise<string> {
  const prepared = await preparePhoto(file);
  const body = new FormData();
  body.set("file", prepared);
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
