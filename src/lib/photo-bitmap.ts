import { MAX_IMAGE_BYTES } from "./image-file";
import {
  OUTPUT_QUALITY,
  adjustImageData,
  needsColor,
  resolveFrame,
  type Frame,
  type PhotoEdit,
  type Size,
} from "./photo-edit";

export type Drawable = CanvasImageSource;
export type Surface = HTMLCanvasElement | OffscreenCanvas;
export type DrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawContext(surface: Surface, readOften = false): DrawContext {
  const ctx = surface.getContext("2d", readOften ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error("Could not prepare that photo on this device.");
  return ctx as DrawContext;
}

/**
 * Draw the edited frame. Quarter-turns, then straighten, then the crop.
 * The bitmap is already upright from EXIF.
 */
export function paintFrame(ctx: DrawContext, bitmap: Drawable, frame: Frame) {
  const width = frame.outputWidth;
  const height = frame.outputHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(width / frame.cropWidth, height / frame.cropHeight);
  ctx.translate(-frame.panX, -frame.panY);
  ctx.rotate(frame.straightenRad);
  ctx.rotate((frame.quarterTurns * Math.PI) / 2);
  ctx.drawImage(bitmap, -frame.sourceWidth / 2, -frame.sourceHeight / 2);
  ctx.restore();
}

export function paintEdit(
  ctx: DrawContext,
  bitmap: Drawable,
  source: Size,
  edit: PhotoEdit,
  maxEdge: number,
  compare: boolean,
) {
  const frame = resolveFrame(source, edit, maxEdge);
  paintFrame(ctx, bitmap, frame);
  if (!compare && needsColor(edit)) {
    const image = ctx.getImageData(0, 0, frame.outputWidth, frame.outputHeight);
    adjustImageData(image.data, edit);
    ctx.putImageData(image, 0, 0);
  }
  return frame;
}

export function blobFromSurface(surface: Surface, type: string, quality: number) {
  if ("convertToBlob" in surface && typeof surface.convertToBlob === "function") {
    return surface.convertToBlob({ type, quality }).catch(() => null);
  }
  return new Promise<Blob | null>((resolve) => {
    (surface as HTMLCanvasElement).toBlob((blob) => resolve(blob), type, quality);
  });
}

async function encodeSurface(surface: Surface, canWebp: boolean, quality: number) {
  if (canWebp) {
    const webp = await blobFromSurface(surface, "image/webp", quality);
    if (webp && webp.type === "image/webp" && webp.size > 0) return webp;
  }
  const jpeg = await blobFromSurface(surface, "image/jpeg", quality);
  if (!jpeg || jpeg.size <= 0) throw new Error("Could not prepare that photo on this device.");
  return jpeg;
}

export async function renderEditedBlob(input: {
  bitmap: Drawable;
  source: Size;
  edit: PhotoEdit;
  canWebp: boolean;
  createSurface: (width: number, height: number) => Surface;
}) {
  const edges = [1600, 1280, 1024, 800];
  const qualities = [OUTPUT_QUALITY, 0.7, 0.6, 0.5];
  let last: Blob | null = null;
  for (const edge of edges) {
    const frame = resolveFrame(input.source, input.edit, edge);
    const surface = input.createSurface(frame.outputWidth, frame.outputHeight);
    const ctx = drawContext(surface, needsColor(input.edit));
    paintFrame(ctx, input.bitmap, frame);
    if (needsColor(input.edit)) {
      const image = ctx.getImageData(0, 0, frame.outputWidth, frame.outputHeight);
      adjustImageData(image.data, input.edit);
      ctx.putImageData(image, 0, 0);
    }
    for (const quality of qualities) {
      last = await encodeSurface(surface, input.canWebp, quality);
      if (last.size <= MAX_IMAGE_BYTES) return last;
    }
  }
  if (last && last.size <= MAX_IMAGE_BYTES) return last;
  throw new Error("That photo is still too large after compressing. Try a different one.");
}

export function drawWithOrientation(
  ctx: DrawContext,
  image: Drawable,
  orientation: number,
  width: number,
  height: number,
) {
  const swaps = orientation >= 5;
  const canvasWidth = swaps ? height : width;
  const canvasHeight = swaps ? width : height;
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, canvasWidth, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, canvasWidth, canvasHeight);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, canvasHeight);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, canvasWidth, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, canvasWidth, canvasHeight);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, canvasHeight);
      break;
    default:
      break;
  }
  ctx.drawImage(image, 0, 0, width, height);
}
