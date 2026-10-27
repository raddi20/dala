import { MAX_IMAGE_BYTES } from "@/lib/image-file";
import type { UploadPurpose } from "@/lib/image-upload";

/** Longest side of a saved photo. Never upscale past the original. */
export const MAX_EDGE = 1600;
/** Preview while editing. Full resolution is used once, on save. */
export const PREVIEW_EDGE = 1100;
/**
 * Saved photos aim for this size. The upload goes through a serverless
 * function that refuses bodies over about 4.5 MB, so a photo just under the
 * 5 MB limit would fail to upload even though it is "small enough".
 */
export const UPLOAD_TARGET_BYTES = 4 * 1024 * 1024;
/** Decoded photos are shrunk to this longest side so huge phone photos do not stall or blank out on mobile. */
export const DECODE_MAX_EDGE = 4096;
/** Neutral padding colour, a warm light grey that sits well on the app's paper background. */
export const NEUTRAL_PADDING = "#ece8e1";
/** Laplacian is measured on a small grey copy, not the full photo. */
export const BLUR_SAMPLE_EDGE = 200;
export const OUTPUT_QUALITY = 0.8;
/** One-tap enhance. Gentle, so skin and food are not oversaturated. */
export const ENHANCE_SATURATION = 1.12;
export const STRAIGHTEN_MAX = 15;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
/** Shop banner on a phone is 2:1. Wider screens crop the sides a little. */
export const COVER_ASPECT = 2;
export const SMALL_SHORT_EDGE = 600;
/** Variance below this, on a ~200px grey copy, counts as blurry. */
export const BLUR_VARIANCE_LIMIT = 50;
export const DARK_MEAN = 60;
export const BRIGHT_MEAN = 200;
export const CLIP_FRACTION = 0.2;
export const CLIP_LOW = 12;
export const CLIP_HIGH = 243;

export type Size = { width: number; height: number };
export type AspectPreset = "square" | "original" | "cover";
/** contain shows the whole photo and pads the rest. cover fills the frame and crops. */
export type FitMode = "contain" | "cover";
export type PaddingStyle = "blur" | "neutral";

export type PhotoEdit = {
  quarterTurns: number;
  straighten: number;
  aspect: AspectPreset;
  fit: FitMode;
  padding: PaddingStyle;
  zoom: number;
  panX: number;
  panY: number;
  enhance: boolean;
  brightness: number;
  warmth: number;
};

export type ChannelLevels = { low: number; high: number };
export type RgbLevels = { r: ChannelLevels; g: ChannelLevels; b: ChannelLevels };

export type Frame = {
  sourceWidth: number;
  sourceHeight: number;
  quarterTurns: number;
  straightenRad: number;
  cropWidth: number;
  cropHeight: number;
  panX: number;
  panY: number;
  /** How far the window can move either way, in source pixels. Zero means that axis is fixed. */
  spareX: number;
  spareY: number;
  fit: FitMode;
  padding: PaddingStyle;
  /** True when part of the frame is not photo, so a backdrop must be painted first. */
  needsBackdrop: boolean;
  outputWidth: number;
  outputHeight: number;
};

export type QualityWarning = {
  id: "blur" | "dark" | "bright" | "small";
  message: string;
  tip: string;
};

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function defaultEdit(purpose: UploadPurpose): PhotoEdit {
  return {
    quarterTurns: 0,
    straighten: 0,
    aspect: purpose === "banner" ? "cover" : purpose === "avatar" ? "square" : "original",
    // Whole photo first. Nothing is cut off until the person zooms in or picks "Fill the frame".
    fit: "contain",
    padding: "blur",
    zoom: 1,
    panX: 0,
    panY: 0,
    enhance: false,
    brightness: 0,
    warmth: 0,
  };
}

/** Full frame, no colour changes. Still resized and re-encoded on save. */
export function identityEdit(): PhotoEdit {
  return { ...defaultEdit("listing"), aspect: "original", fit: "cover" };
}

export function editForSave(action: "as-is" | "save", edit: PhotoEdit): PhotoEdit {
  return action === "as-is" ? identityEdit() : edit;
}

export function needsColor(edit: PhotoEdit) {
  return edit.enhance || edit.brightness !== 0 || edit.warmth !== 0;
}

export function aspectPresets(purpose: UploadPurpose): { id: AspectPreset; label: string; hint: string }[] {
  const square = { id: "square" as const, label: "Square", hint: "Square crop, for cards and the shop logo" };
  const original = { id: "original" as const, label: "Original", hint: "Keep the photo's own shape" };
  const cover = { id: "cover" as const, label: "Cover", hint: "Wide 2 to 1 crop for the shop banner" };
  if (purpose === "banner") return [cover, original, square];
  return [square, original];
}

export function resizeDimensions(width: number, height: number, maxEdge = MAX_EDGE): Size {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const longest = Math.max(safeWidth, safeHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

export function orientedSize(width: number, height: number, quarterTurns: number): Size {
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  if (turns % 2 === 1) return { width: height, height: width };
  return { width, height };
}

export function presetAspect(preset: AspectPreset, oriented: Size) {
  if (preset === "square") return 1;
  if (preset === "cover") return COVER_ASPECT;
  return oriented.width / Math.max(1, oriented.height);
}

/**
 * Largest upright crop of the given aspect that stays inside the image
 * after a rotation of `degrees` around the centre.
 */
export function safeCropSize(width: number, height: number, degrees: number, aspect: number): Size {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const rad = Math.abs(degrees) * (Math.PI / 180);
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const ratio = Math.max(0.05, aspect);
  const cropHeight = Math.min(safeWidth / (ratio * cos + sin), safeHeight / (ratio * sin + cos));
  let cropWidth = ratio * cropHeight;
  let nextHeight = cropHeight;
  if (!(cropWidth > 0) || !(nextHeight > 0)) {
    return { width: safeWidth, height: safeHeight };
  }
  if (Math.abs(degrees) >= 0.01) {
    cropWidth *= 0.999;
    nextHeight *= 0.999;
  }
  return {
    width: Math.min(safeWidth, Math.max(1, cropWidth)),
    height: Math.min(safeHeight, Math.max(1, nextHeight)),
  };
}

/**
 * Smallest window of the given aspect that holds the whole image.
 * A wide photo in a tall frame gets extra height (padding above and below), and the reverse.
 */
export function containWindow(width: number, height: number, aspect: number): Size {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const ratio = Math.max(0.05, aspect);
  if (safeWidth / safeHeight >= ratio) return { width: safeWidth, height: safeWidth / ratio };
  return { width: safeHeight * ratio, height: safeHeight };
}

export function resolveFrame(source: Size, edit: PhotoEdit, maxEdge = MAX_EDGE): Frame {
  const turns = ((Math.round(edit.quarterTurns) % 4) + 4) % 4;
  const oriented = orientedSize(source.width, source.height, turns);
  const aspect = presetAspect(edit.aspect, oriented);
  const straighten = clamp(edit.straighten, -STRAIGHTEN_MAX, STRAIGHTEN_MAX);
  const contain = edit.fit === "contain";
  const base = contain
    ? containWindow(oriented.width, oriented.height, aspect)
    : safeCropSize(oriented.width, oriented.height, straighten, aspect);
  const zoom = clamp(edit.zoom, MIN_ZOOM, MAX_ZOOM);
  const cropWidth = Math.max(1, base.width / zoom);
  const cropHeight = Math.max(1, base.height / zoom);
  // Contain: the window may move only while it is smaller than the photo. Larger than the photo, it stays centred.
  const spareX = contain ? Math.max(0, (oriented.width - cropWidth) / 2) : Math.max(0, (base.width - cropWidth) / 2);
  const spareY = contain ? Math.max(0, (oriented.height - cropHeight) / 2) : Math.max(0, (base.height - cropHeight) / 2);
  const output = resizeDimensions(cropWidth, cropHeight, maxEdge);
  const needsBackdrop =
    contain &&
    (cropWidth > oriented.width + 0.5 || cropHeight > oriented.height + 0.5 || Math.abs(straighten) >= 0.01);
  return {
    sourceWidth: source.width,
    sourceHeight: source.height,
    quarterTurns: turns,
    straightenRad: (straighten * Math.PI) / 180,
    cropWidth,
    cropHeight,
    panX: clamp(edit.panX, -1, 1) * spareX,
    panY: clamp(edit.panY, -1, 1) * spareY,
    spareX,
    spareY,
    fit: contain ? "contain" : "cover",
    padding: edit.padding === "neutral" ? "neutral" : "blur",
    needsBackdrop,
    outputWidth: output.width,
    outputHeight: output.height,
  };
}

/** Largest rectangle of the given content shape that fits inside the stage. */
export function fitRect(stage: Size, content: Size): Size {
  const stageWidth = Math.max(0, stage.width);
  const stageHeight = Math.max(0, stage.height);
  if (stageWidth === 0 || stageHeight === 0 || content.width < 1 || content.height < 1) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(stageWidth / content.width, stageHeight / content.height);
  return { width: content.width * scale, height: content.height * scale };
}

/**
 * Turn a finger or mouse drag into a new pan. The photo follows the finger,
 * so dragging right moves the window left. Returns normalised pan, -1 to 1.
 */
export function panAfterDrag(
  start: { panX: number; panY: number },
  dragPx: { x: number; y: number },
  frame: Pick<Frame, "cropWidth" | "cropHeight" | "spareX" | "spareY">,
  display: Size,
) {
  if (display.width < 1 || display.height < 1) return { panX: start.panX, panY: start.panY };
  const axis = (startPan: number, drag: number, crop: number, spare: number, shown: number) => {
    if (!(spare > 0)) return 0;
    const units = clamp(startPan, -1, 1) * spare - drag * (crop / shown);
    return clamp(units / spare, -1, 1);
  };
  return {
    panX: axis(start.panX, dragPx.x, frame.cropWidth, frame.spareX, display.width),
    panY: axis(start.panY, dragPx.y, frame.cropHeight, frame.spareY, display.height),
  };
}

/** True when every corner of the upright crop still lands inside the rotated image. */
export function cropCornersInside(width: number, height: number, degrees: number, cropWidth: number, cropHeight: number, panX = 0, panY = 0) {
  const rad = (Math.abs(degrees) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const xs = [panX - cropWidth / 2, panX + cropWidth / 2];
  const ys = [panY - cropHeight / 2, panY + cropHeight / 2];
  for (const x of xs) {
    for (const y of ys) {
      const ix = Math.abs(x * cos + y * sin);
      const iy = Math.abs(-x * sin + y * cos);
      if (ix > width / 2 + 1 || iy > height / 2 + 1) return false;
    }
  }
  return true;
}

export function encodeTarget(canWebp: boolean): {
  mime: "image/webp" | "image/jpeg";
  quality: number;
  extension: "webp" | "jpg";
} {
  if (canWebp) return { mime: "image/webp", quality: OUTPUT_QUALITY, extension: "webp" };
  return { mime: "image/jpeg", quality: OUTPUT_QUALITY, extension: "jpg" };
}

export function exportPlan(source: Size, choice: PhotoEdit | "as-is", canWebp: boolean) {
  const edit = choice === "as-is" ? identityEdit() : choice;
  const frame = resolveFrame(source, edit, MAX_EDGE);
  const target = encodeTarget(canWebp);
  return {
    width: frame.outputWidth,
    height: frame.outputHeight,
    mime: target.mime,
    quality: target.quality,
    extension: target.extension,
    maxBytes: MAX_IMAGE_BYTES,
    stripsMetadata: true,
    upscaled: frame.outputWidth > source.width + 0.5 || frame.outputHeight > source.height + 0.5,
    colorAdjusted: choice !== "as-is" && needsColor(edit),
  };
}

export function greyLuma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function rgbaToGrey(data: ArrayLike<number>) {
  const grey = new Uint8Array(Math.floor(data.length / 4));
  for (let i = 0, pixel = 0; i + 2 < data.length; i += 4, pixel += 1) {
    grey[pixel] = clamp(Math.round(greyLuma(data[i], data[i + 1], data[i + 2])), 0, 255);
  }
  return grey;
}

export function laplacianVariance(grey: ArrayLike<number>, width: number, height: number) {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const index = row + x;
      const lap = grey[index - width] + grey[index + width] + grey[index - 1] + grey[index + 1] - 4 * grey[index];
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export function brightnessStats(grey: ArrayLike<number>) {
  const count = grey.length;
  if (count === 0) return { mean: 0, darkClip: 0, brightClip: 0 };
  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (let i = 0; i < count; i += 1) {
    const value = grey[i];
    sum += value;
    if (value <= CLIP_LOW) dark += 1;
    else if (value >= CLIP_HIGH) bright += 1;
  }
  return { mean: sum / count, darkClip: dark / count, brightClip: bright / count };
}

export function qualityWarnings(input: {
  variance: number;
  mean: number;
  darkClip: number;
  brightClip: number;
  width: number;
  height: number;
}): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  if (!(input.variance >= BLUR_VARIANCE_LIMIT)) {
    warnings.push({
      id: "blur",
      message: "This looks a bit blurry.",
      tip: "Hold the phone steady and tap the subject so it can focus.",
    });
  }
  if (input.mean < DARK_MEAN || input.darkClip > CLIP_FRACTION) {
    warnings.push({
      id: "dark",
      message: "This looks dark.",
      tip: "Move into daylight, or face a window.",
    });
  }
  if (input.mean > BRIGHT_MEAN || input.brightClip > CLIP_FRACTION) {
    warnings.push({
      id: "bright",
      message: "This looks too bright.",
      tip: "Turn so the light is not behind the subject.",
    });
  }
  if (Math.min(input.width, input.height) < SMALL_SHORT_EDGE) {
    warnings.push({
      id: "small",
      message: "This photo is small.",
      tip: "Move closer, or choose a larger photo. It will look sharper on the shop.",
    });
  }
  return warnings;
}

export function histogramPercentile(hist: ArrayLike<number>, count: number, percentile: number) {
  if (count <= 0) return 0;
  const target = clamp(percentile, 0, 1) * count;
  let seen = 0;
  for (let i = 0; i < hist.length; i += 1) {
    seen += hist[i];
    if (seen >= target) return i;
  }
  return hist.length - 1;
}

export function levelsFromHistogram(hist: Uint32Array, count: number): ChannelLevels {
  const low = histogramPercentile(hist, count, 0.005);
  const high = histogramPercentile(hist, count, 0.995);
  if (high - low < 16) return { low: 0, high: 255 };
  if (low < 2 && high > 253) return { low: 0, high: 255 };
  return { low, high };
}

export function levelsFromPixels(data: Uint8ClampedArray, pixelStride = 1): RgbLevels {
  const red = new Uint32Array(256);
  const green = new Uint32Array(256);
  const blue = new Uint32Array(256);
  const step = Math.max(1, pixelStride) * 4;
  let count = 0;
  for (let i = 0; i + 2 < data.length; i += step) {
    red[data[i]] += 1;
    green[data[i + 1]] += 1;
    blue[data[i + 2]] += 1;
    count += 1;
  }
  return {
    r: levelsFromHistogram(red, count),
    g: levelsFromHistogram(green, count),
    b: levelsFromHistogram(blue, count),
  };
}

export function stretchChannel(value: number, levels: ChannelLevels) {
  const span = levels.high - levels.low;
  if (span <= 0) return clamp(value, 0, 255);
  return clamp(((value - levels.low) * 255) / span, 0, 255);
}

export function applyColor(
  r: number,
  g: number,
  b: number,
  options: { levels: RgbLevels | null; saturation: number; brightness: number; warmth: number },
) {
  let red = r;
  let green = g;
  let blue = b;
  if (options.levels) {
    red = stretchChannel(red, options.levels.r);
    green = stretchChannel(green, options.levels.g);
    blue = stretchChannel(blue, options.levels.b);
  }
  const saturation = options.saturation;
  if (saturation !== 1) {
    const luma = greyLuma(red, green, blue);
    red = luma + (red - luma) * saturation;
    green = luma + (green - luma) * saturation;
    blue = luma + (blue - luma) * saturation;
  }
  const bright = options.brightness * 36;
  red += bright;
  green += bright;
  blue += bright;
  const warm = options.warmth * 22;
  red += warm;
  blue -= warm;
  return {
    r: clamp(Math.round(red), 0, 255),
    g: clamp(Math.round(green), 0, 255),
    b: clamp(Math.round(blue), 0, 255),
  };
}

export function colorOptions(edit: PhotoEdit, levels: RgbLevels | null) {
  return {
    levels: edit.enhance ? levels : null,
    saturation: edit.enhance ? ENHANCE_SATURATION : 1,
    brightness: edit.brightness,
    warmth: edit.warmth,
  };
}

export function adjustImageData(data: Uint8ClampedArray, edit: PhotoEdit) {
  if (!needsColor(edit)) return;
  const stride = data.length > 800_000 ? 4 : 1;
  const levels = edit.enhance ? levelsFromPixels(data, stride) : null;
  const options = colorOptions(edit, levels);
  for (let i = 0; i + 2 < data.length; i += 4) {
    const next = applyColor(data[i], data[i + 1], data[i + 2], options);
    data[i] = next.r;
    data[i + 1] = next.g;
    data[i + 2] = next.b;
  }
}

export function orientationSwapsAxes(orientation: number) {
  return orientation >= 5 && orientation <= 8;
}

export function orientedPixelSize(width: number, height: number, orientation: number): Size {
  return orientationSwapsAxes(orientation) ? { width: height, height: width } : { width, height };
}

function read16(view: DataView, offset: number, little: boolean) {
  return view.getUint16(offset, little);
}

function read32(view: DataView, offset: number, little: boolean) {
  return view.getUint32(offset, little);
}

function exifOrientation(segment: Uint8Array): number | null {
  if (segment.length < 16) return null;
  if (
    segment[0] !== 0x45 ||
    segment[1] !== 0x78 ||
    segment[2] !== 0x69 ||
    segment[3] !== 0x66 ||
    segment[4] !== 0 ||
    segment[5] !== 0
  ) {
    return null;
  }
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  const little = segment[6] === 0x49 && segment[7] === 0x49;
  const big = segment[6] === 0x4d && segment[7] === 0x4d;
  if (!little && !big) return null;
  if (read16(view, 8, little) !== 0x002a) return null;
  const ifd = 6 + read32(view, 10, little);
  if (ifd + 2 > segment.length) return null;
  const count = read16(view, ifd, little);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > segment.length) return null;
    if (read16(view, entry, little) !== 0x0112) continue;
    const value = read16(view, entry + 8, little);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return null;
}

/** JPEG EXIF orientation, 1 when there is none. GPS and other tags are ignored. */
export function jpegOrientation(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return 1;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x00 || marker === 0xd8) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return 1;
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2 || offset + 2 + size > bytes.length) return 1;
    if (marker === 0xe1) {
      const found = exifOrientation(bytes.subarray(offset + 4, offset + 2 + size));
      if (found) return found;
    }
    offset += 2 + size;
  }
  return 1;
}

/** Unrotated JPEG size from the SOF marker, before EXIF orientation. */
export function jpegSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x00) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2 || offset + 2 + size > bytes.length) return null;
    const isSof =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;
    if (isSof) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    offset += 2 + size;
  }
  return null;
}
