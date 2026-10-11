import { clientImageChoiceError } from "@/lib/image-file";
import { drawWithOrientation, paintEdit, renderEditedBlob, type Surface } from "@/lib/photo-bitmap";
import {
  BLUR_SAMPLE_EDGE,
  PREVIEW_EDGE,
  brightnessStats,
  jpegOrientation,
  jpegSize,
  laplacianVariance,
  orientationSwapsAxes,
  orientedPixelSize,
  qualityWarnings,
  resizeDimensions,
  resolveFrame,
  rgbaToGrey,
  type PhotoEdit,
  type QualityWarning,
  type Size,
} from "@/lib/photo-edit";

export type DecodedPhoto = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  close: () => void;
};

const HEADER_BYTES = 512 * 1024;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that photo. Use a JPEG, PNG, or WebP."));
    img.src = src;
  });
}

function surface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function bitmapFromElement(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (typeof createImageBitmap !== "function") {
      throw new Error("Could not read that photo on this device.");
    }
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function needsManualOrientation(bitmap: ImageBitmap, orientation: number, sof: Size | null, fromImage: boolean) {
  if (orientation <= 1) return false;
  if (!sof) return !fromImage;
  if (orientationSwapsAxes(orientation)) {
    const swapped = bitmap.width === sof.height && bitmap.height === sof.width;
    return !swapped;
  }
  return !fromImage;
}

async function applyOrientation(bitmap: ImageBitmap, orientation: number) {
  const size = orientedPixelSize(bitmap.width, bitmap.height, orientation);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo on this device.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  drawWithOrientation(ctx, bitmap, orientation, bitmap.width, bitmap.height);
  return createImageBitmap(canvas);
}

/**
 * Decode a photo upright. Prefers createImageBitmap({ imageOrientation: "from-image" }).
 * If that option is ignored, a small EXIF reader applies orientation 1–8.
 * The pixels returned here have no EXIF attached; saving draws them onto a new canvas.
 */
export async function decodePhoto(file: File): Promise<DecodedPhoto> {
  const choice = clientImageChoiceError(file);
  if (choice) throw new Error(choice);

  const header = new Uint8Array(await file.slice(0, Math.min(file.size, HEADER_BYTES)).arrayBuffer());
  const orientation = jpegOrientation(header);
  const sof = jpegSize(header);

  let bitmap: ImageBitmap | null = null;
  let fromImage = false;
  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      fromImage = true;
    } catch {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        bitmap = null;
      }
    }
  }
  if (!bitmap) bitmap = await bitmapFromElement(file);

  if (needsManualOrientation(bitmap, orientation, sof, fromImage)) {
    const fixed = await applyOrientation(bitmap, orientation);
    bitmap.close?.();
    bitmap = fixed;
  }

  if (bitmap.width < 1 || bitmap.height < 1) {
    bitmap.close?.();
    throw new Error("Could not read that photo. Use a JPEG, PNG, or WebP.");
  }

  const held = bitmap;
  return {
    bitmap: held,
    width: held.width,
    height: held.height,
    close: () => held.close?.(),
  };
}

let webpSupport: Promise<boolean> | null = null;

export function supportsWebpEncode() {
  if (typeof document === "undefined") return Promise.resolve(false);
  if (!webpSupport) {
    webpSupport = (async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        ctx.fillStyle = "#c8881a";
        ctx.fillRect(0, 0, 2, 2);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/webp", 0.8));
        return Boolean(blob && blob.type === "image/webp" && blob.size > 0);
      } catch {
        return false;
      }
    })();
  }
  return webpSupport;
}

export function paintPreview(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  source: Size,
  edit: PhotoEdit,
  compare: boolean,
) {
  const frame = resolveFrame(source, edit, PREVIEW_EDGE);
  if (canvas.width !== frame.outputWidth || canvas.height !== frame.outputHeight) {
    canvas.width = frame.outputWidth;
    canvas.height = frame.outputHeight;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not prepare that photo on this device.");
  paintEdit(ctx, bitmap, source, edit, PREVIEW_EDGE, compare);
  return frame;
}

export function warningsFromPreview(canvas: HTMLCanvasElement, crop: Size): QualityWarning[] {
  if (canvas.width < 3 || canvas.height < 3) return [];
  const sample = resizeDimensions(canvas.width, canvas.height, BLUR_SAMPLE_EDGE);
  const small = document.createElement("canvas");
  small.width = sample.width;
  small.height = sample.height;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height);
  const grey = rgbaToGrey(pixels.data);
  const tone = brightnessStats(grey);
  return qualityWarnings({
    variance: laplacianVariance(grey, sample.width, sample.height),
    mean: tone.mean,
    darkClip: tone.darkClip,
    brightClip: tone.brightClip,
    width: crop.width,
    height: crop.height,
  });
}

function mainSurface(width: number, height: number) {
  return surface(width, height);
}

async function renderOnMain(bitmap: ImageBitmap, source: Size, edit: PhotoEdit, canWebp: boolean) {
  return renderEditedBlob({
    bitmap,
    source,
    edit,
    canWebp,
    createSurface: mainSurface,
  });
}

function renderInWorker(bitmap: ImageBitmap, source: Size, edit: PhotoEdit, canWebp: boolean) {
  return new Promise<Blob>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./photo-worker.ts", import.meta.url), { type: "module" });
    } catch (error) {
      bitmap.close?.();
      reject(error);
      return;
    }
    let settled = false;
    const finish = (error: Error | null, blob?: Blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (blob) resolve(blob);
      else reject(error ?? new Error("Could not prepare that photo on this device."));
    };
    const timer = setTimeout(() => finish(new Error("timeout")), 25_000);
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
      if (event.data?.blob) finish(null, event.data.blob);
      else finish(new Error(event.data?.error || "Could not prepare that photo on this device."));
    };
    worker.onerror = () => finish(new Error("worker"));
    try {
      worker.postMessage({ bitmap, source, edit, canWebp }, [bitmap]);
    } catch (error) {
      bitmap.close?.();
      finish(error instanceof Error ? error : new Error("worker"));
    }
  });
}

/** Full-resolution encode. Strips EXIF by drawing onto a new canvas. WebP, or JPEG if WebP is missing. */
export async function finalizePhoto(decoded: DecodedPhoto, edit: PhotoEdit) {
  const source = { width: decoded.width, height: decoded.height };
  const canWebp = await supportsWebpEncode();
  let blob: Blob | null = null;
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      const copy = await createImageBitmap(decoded.bitmap);
      blob = await renderInWorker(copy, source, edit, canWebp);
    } catch {
      blob = null;
    }
  }
  if (!blob) blob = await renderOnMain(decoded.bitmap, source, edit, canWebp);
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  return new File([blob], `photo.${extension}`, { type, lastModified: Date.now() });
}
