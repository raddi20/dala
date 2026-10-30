import assert from "node:assert/strict";
import test from "node:test";
import { MAX_IMAGE_BYTES } from "./image-file";
import {
  BLUR_SAMPLE_EDGE,
  BLUR_VARIANCE_LIMIT,
  ENHANCE_SATURATION,
  SMALL_SHORT_EDGE,
  applyColor,
  aspectPresets,
  brightnessStats,
  MAX_ZOOM,
  MIN_ZOOM,
  centreEdit,
  cropCornersInside,
  defaultEdit,
  editForSave,
  encodeTarget,
  exportPlan,
  greyLuma,
  histogramPercentile,
  identityEdit,
  jpegOrientation,
  jpegSize,
  laplacianVariance,
  levelsFromHistogram,
  orientedPixelSize,
  orientedSize,
  presetAspect,
  qualityWarnings,
  zoomEdit,
  resizeDimensions,
  resolveFrame,
  safeCropSize,
  stretchChannel,
} from "./photo-edit";

function checker(size: number) {
  const grey = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) grey[y * size + x] = (x + y) % 2 === 0 ? 0 : 255;
  }
  return grey;
}

function ramp(width: number, height: number) {
  const grey = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) grey[y * width + x] = x;
  }
  return grey;
}

function exifJpeg(orientation: number) {
  const payload = new Uint8Array(32);
  payload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0);
  const view = new DataView(payload.buffer);
  view.setUint8(6, 0x49);
  view.setUint8(7, 0x49);
  view.setUint16(8, 0x002a, true);
  view.setUint32(10, 8, true);
  view.setUint16(14, 1, true);
  view.setUint16(16, 0x0112, true);
  view.setUint16(18, 3, true);
  view.setUint32(20, 1, true);
  view.setUint16(24, orientation, true);
  const segment = new Uint8Array(2 + 2 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = 0x00;
  segment[3] = payload.length + 2;
  segment.set(payload, 4);
  const sof = new Uint8Array([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00]);
  const bytes = new Uint8Array(2 + segment.length + sof.length + 2);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes.set(segment, 2);
  bytes.set(sof, 2 + segment.length);
  bytes[bytes.length - 2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;
  return bytes;
}

test("resizeDimensions never upscales and caps the long edge", () => {
  assert.deepEqual(resizeDimensions(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(resizeDimensions(800, 600), { width: 800, height: 600 });
  assert.deepEqual(resizeDimensions(1600, 900), { width: 1600, height: 900 });
  assert.deepEqual(resizeDimensions(100, 4000), { width: 40, height: 1600 });
  assert.deepEqual(resizeDimensions(10, 10), { width: 10, height: 10 });
  assert.deepEqual(resizeDimensions(4032, 3024, BLUR_SAMPLE_EDGE), { width: 200, height: 150 });
});

test("crop presets and quarter turns", () => {
  assert.deepEqual(orientedSize(4000, 3000, 0), { width: 4000, height: 3000 });
  assert.deepEqual(orientedSize(4000, 3000, 1), { width: 3000, height: 4000 });
  assert.deepEqual(orientedSize(4000, 3000, 2), { width: 4000, height: 3000 });
  assert.equal(presetAspect("square", { width: 4000, height: 3000 }), 1);
  assert.equal(presetAspect("cover", { width: 4000, height: 3000 }), 2);
  assert.equal(presetAspect("card", { width: 4000, height: 2000 }), 4 / 3);
  assert.equal(presetAspect("original", { width: 4000, height: 3000 }), 4000 / 3000);

  const square = resolveFrame({ width: 4000, height: 3000 }, { ...identityEdit(), aspect: "square" });
  assert.equal(square.outputWidth, 1600);
  assert.equal(square.outputHeight, 1600);
  assert.ok(Math.abs(square.cropWidth - 3000) < 1);
  assert.ok(Math.abs(square.cropHeight - 3000) < 1);

  const cover = resolveFrame({ width: 4000, height: 3000 }, { ...identityEdit(), aspect: "cover" });
  assert.equal(cover.outputWidth, 1600);
  assert.equal(cover.outputHeight, 800);
  assert.ok(Math.abs(cover.cropWidth / cover.cropHeight - 2) < 0.01);

  const card = resolveFrame({ width: 4000, height: 2000 }, { ...identityEdit(), aspect: "card" });
  assert.equal(card.outputWidth, 1600);
  assert.equal(card.outputHeight, 1200);
  assert.ok(Math.abs(card.cropWidth / card.cropHeight - 4 / 3) < 0.01);
});

test("straighten shrinks the frame so the corners stay inside", () => {
  const full = safeCropSize(1000, 1000, 0, 1);
  const tilted = safeCropSize(1000, 1000, 15, 1);
  assert.ok(Math.abs(full.width - 1000) < 0.01);
  assert.ok(tilted.width < full.width);
  assert.ok(tilted.height < full.height);
  for (const degrees of [0, 1, 8, 15, -15]) {
    const crop = safeCropSize(2000, 1200, degrees, 2);
    assert.equal(cropCornersInside(2000, 1200, degrees, crop.width, crop.height), true);
  }
});

test("pan stays inside the safe crop", () => {
  const edit = { ...identityEdit(), zoom: 2, panX: 8, panY: -3 };
  const frame = resolveFrame({ width: 1000, height: 800 }, edit, 10_000);
  const safe = safeCropSize(1000, 800, 0, 1000 / 800);
  const spareX = (safe.width - safe.width / 2) / 2;
  assert.ok(Math.abs(frame.panX - spareX) < 0.02);
  assert.ok(Math.abs(frame.panY) <= (safe.height - safe.height / 2) / 2 + 0.02);
  assert.equal(cropCornersInside(1000, 800, 0, frame.cropWidth, frame.cropHeight, frame.panX, frame.panY), true);
});

test("zoom out below 1 fits a phone portrait in the crop", () => {
  assert.equal(MIN_ZOOM, 0.25);
  assert.equal(MAX_ZOOM, 4);
  const phone = { width: 1080, height: 1920 };
  for (const aspect of ["card", "cover", "square"] as const) {
    const fitted = resolveFrame(phone, { ...identityEdit(), aspect, zoom: MIN_ZOOM }, 100_000);
    assert.ok(fitted.cropWidth >= phone.width - 1, aspect);
    assert.ok(fitted.cropHeight >= phone.height - 1, aspect);
  }
  const card = { ...identityEdit(), aspect: "card" as const, zoom: 1 };
  const tight = resolveFrame(phone, card, 100_000);
  const fitted = resolveFrame(phone, { ...card, zoom: MIN_ZOOM }, 100_000);
  assert.ok(fitted.cropWidth > tight.cropWidth);
  assert.ok(Math.abs(fitted.cropWidth / fitted.cropHeight - 4 / 3) < 0.01);
  const clampedOut = resolveFrame(phone, { ...card, zoom: 0.01 }, 100_000);
  assert.ok(Math.abs(clampedOut.cropWidth - fitted.cropWidth) < 0.5);
  const atMax = resolveFrame(phone, { ...card, zoom: MAX_ZOOM }, 100_000);
  const clampedIn = resolveFrame(phone, { ...card, zoom: 99 }, 100_000);
  assert.ok(Math.abs(clampedIn.cropWidth - atMax.cropWidth) < 0.5);
  assert.ok(atMax.cropWidth < tight.cropWidth);

  const zoomedOut = zoomEdit({ ...card, zoom: 1 }, 1 / 1.1);
  assert.ok(zoomedOut.zoom < 1);
  assert.equal(zoomedOut.aspect, "card");
  assert.equal(zoomEdit({ ...card, zoom: MIN_ZOOM }, 0.5).zoom, MIN_ZOOM);
  assert.equal(zoomEdit({ ...card, zoom: MAX_ZOOM }, 2).zoom, MAX_ZOOM);

  const shifted = { ...card, zoom: 2.4, panX: 0.6, panY: -0.4, enhance: true };
  const centred = centreEdit(shifted);
  assert.equal(centred.panX, 0);
  assert.equal(centred.panY, 0);
  assert.equal(centred.zoom, shifted.zoom);
  assert.equal(centred.aspect, shifted.aspect);
  assert.equal(centred.enhance, true);
});

test("use as is keeps the full frame, resizes, and encodes", () => {
  const phone = exportPlan({ width: 4000, height: 3000 }, "as-is", true);
  assert.equal(phone.width, 1600);
  assert.equal(phone.height, 1200);
  assert.equal(phone.mime, "image/webp");
  assert.equal(phone.quality, 0.8);
  assert.equal(phone.extension, "webp");
  assert.equal(phone.stripsMetadata, true);
  assert.equal(phone.upscaled, false);
  assert.equal(phone.colorAdjusted, false);
  assert.equal(phone.maxBytes, MAX_IMAGE_BYTES);

  const small = exportPlan({ width: 800, height: 600 }, "as-is", true);
  assert.equal(small.width, 800);
  assert.equal(small.height, 600);
  assert.equal(small.upscaled, false);

  const jpeg = exportPlan({ width: 4000, height: 3000 }, "as-is", false);
  assert.equal(jpeg.mime, "image/jpeg");
  assert.equal(jpeg.extension, "jpg");
  assert.deepEqual(encodeTarget(true).mime, "image/webp");

  const messy = {
    ...identityEdit(),
    aspect: "square" as const,
    enhance: true,
    brightness: 0.4,
    warmth: -0.2,
    quarterTurns: 1,
    straighten: 9,
    zoom: 2,
  };
  const passed = editForSave("as-is", messy);
  assert.deepEqual(passed, identityEdit());
  const plan = exportPlan({ width: 4000, height: 3000 }, passed, true);
  assert.equal(plan.width, 1600);
  assert.equal(plan.height, 1200);
  assert.equal(plan.colorAdjusted, false);
  const kept = exportPlan({ width: 4000, height: 3000 }, editForSave("save", messy), true);
  assert.equal(kept.colorAdjusted, true);
  assert.notEqual(kept.width, 1600);
});

test("levels stretch a narrow range and leave a full range alone", () => {
  const hist = new Uint32Array(256);
  hist[10] = 100;
  hist[100] = 800;
  hist[200] = 100;
  const levels = levelsFromHistogram(hist, 1000);
  assert.equal(levels.low, 10);
  assert.equal(levels.high, 200);
  assert.equal(histogramPercentile(hist, 1000, 0.005), 10);
  assert.equal(stretchChannel(10, levels), 0);
  assert.equal(stretchChannel(200, levels), 255);

  const wide = new Uint32Array(256);
  wide[0] = 20;
  wide[255] = 20;
  wide[128] = 960;
  assert.deepEqual(levelsFromHistogram(wide, 1000), { low: 0, high: 255 });
});

test("enhance saturation, brightness, and warmth move the expected channels", () => {
  const flat = applyColor(128, 128, 128, { levels: null, saturation: ENHANCE_SATURATION, brightness: 0, warmth: 0 });
  assert.equal(flat.r, 128);
  assert.equal(flat.g, 128);
  assert.equal(flat.b, 128);

  const redder = applyColor(200, 100, 100, { levels: null, saturation: ENHANCE_SATURATION, brightness: 0, warmth: 0 });
  assert.ok(redder.r > 200);
  assert.ok(redder.g < 100);

  const brighter = applyColor(10, 20, 30, { levels: null, saturation: 1, brightness: 1, warmth: 0 });
  assert.deepEqual(brighter, { r: 46, g: 56, b: 66 });

  const warmer = applyColor(40, 40, 40, { levels: null, saturation: 1, brightness: 0, warmth: 1 });
  assert.equal(warmer.r, 62);
  assert.equal(warmer.g, 40);
  assert.equal(warmer.b, 18);

  const stretched = applyColor(20, 20, 20, {
    levels: { r: { low: 20, high: 200 }, g: { low: 20, high: 200 }, b: { low: 20, high: 200 } },
    saturation: 1,
    brightness: 0,
    warmth: 0,
  });
  assert.deepEqual(stretched, { r: 0, g: 0, b: 0 });
});

test("blur, brightness, and size warnings explain themselves and do not throw", () => {
  const sharp = laplacianVariance(checker(32), 32, 32);
  const soft = laplacianVariance(new Uint8Array(32 * 32).fill(40), 32, 32);
  const graded = laplacianVariance(ramp(32, 32), 32, 32);
  assert.ok(sharp > BLUR_VARIANCE_LIMIT);
  assert.equal(soft, 0);
  assert.ok(graded < BLUR_VARIANCE_LIMIT);

  const dark = brightnessStats(new Uint8Array(100).fill(20));
  const mid = brightnessStats(new Uint8Array(100).fill(140));
  const bright = brightnessStats(new Uint8Array(100).fill(230));
  const clipped = new Uint8Array(100).fill(140);
  clipped.fill(0, 0, 30);
  const clip = brightnessStats(clipped);
  assert.ok(dark.mean < 60);
  assert.ok(bright.mean > 200);
  assert.ok(clip.darkClip > 0.2);

  const blurry = qualityWarnings({ variance: soft, mean: mid.mean, darkClip: 0, brightClip: 0, width: 1200, height: 900 });
  assert.equal(blurry.length, 1);
  assert.match(blurry[0].message, /blurry/i);
  assert.match(blurry[0].tip, /steady/i);

  const dim = qualityWarnings({ variance: sharp, mean: dark.mean, darkClip: dark.darkClip, brightClip: 0, width: 1200, height: 900 });
  assert.equal(dim[0].id, "dark");
  assert.match(dim[0].tip, /daylight/i);

  const washed = qualityWarnings({
    variance: sharp,
    mean: bright.mean,
    darkClip: 0,
    brightClip: bright.brightClip,
    width: 1200,
    height: 900,
  });
  assert.equal(washed.some((item) => item.id === "bright"), true);

  const tiny = qualityWarnings({ variance: sharp, mean: mid.mean, darkClip: 0, brightClip: 0, width: 800, height: SMALL_SHORT_EDGE - 1 });
  assert.equal(tiny.some((item) => item.id === "small"), true);
  const largeEnough = qualityWarnings({
    variance: sharp,
    mean: mid.mean,
    darkClip: 0,
    brightClip: 0,
    width: 800,
    height: SMALL_SHORT_EDGE,
  });
  assert.equal(largeEnough.some((item) => item.id === "small"), false);

  const greyRed = Math.round(greyLuma(255, 0, 0));
  assert.equal(greyRed, 76);
});

test("EXIF orientation is read and axis swaps are known", () => {
  const turned = exifJpeg(6);
  assert.equal(jpegOrientation(turned), 6);
  assert.deepEqual(jpegSize(turned), { width: 32, height: 16 });
  assert.deepEqual(orientedPixelSize(32, 16, 6), { width: 16, height: 32 });
  assert.equal(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), 1);
  assert.equal(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), 1);
  assert.equal(jpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), null);
});

test("presets follow the upload purpose", () => {
  assert.equal(defaultEdit("avatar").aspect, "square");
  assert.equal(defaultEdit("banner").aspect, "cover");
  assert.equal(defaultEdit("offering").aspect, "original");
  assert.equal(defaultEdit("listing").aspect, "original");
  assert.deepEqual(
    aspectPresets("banner").map((item) => item.id),
    ["cover", "original", "square"],
  );
  assert.deepEqual(
    aspectPresets("avatar").map((item) => item.id),
    ["square", "original"],
  );
  assert.deepEqual(
    aspectPresets("offering").map((item) => item.id),
    ["card", "square", "original"],
  );
  assert.deepEqual(
    aspectPresets("listing").map((item) => item.id),
    ["card", "square", "original"],
  );
  assert.equal(aspectPresets("listing").some((item) => item.id === "cover"), false);
});
