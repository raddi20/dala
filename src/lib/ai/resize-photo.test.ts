import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  downloadListingPhoto,
  isAllowedListingPhotoUrl,
  LISTING_PHOTO_MAX_PX,
  resizeListingPhoto,
} from "@/lib/ai/resize-photo";

test("listing photos are accepted only from the blob host", () => {
  assert.equal(isAllowedListingPhotoUrl("https://store.public.blob.vercel-storage.com/sofa.jpg"), true);
  assert.equal(isAllowedListingPhotoUrl("http://store.public.blob.vercel-storage.com/sofa.jpg"), false);
  assert.equal(isAllowedListingPhotoUrl("https://evil.example/sofa.jpg"), false);
  assert.equal(isAllowedListingPhotoUrl("https://user:pass@store.public.blob.vercel-storage.com/sofa.jpg"), false);
});

test("a redirect and a non-blob response are not downloaded", async () => {
  const blob = "https://store.public.blob.vercel-storage.com/sofa.jpg";
  await assert.rejects(
    downloadListingPhoto(blob, async () => new Response(null, { status: 302, headers: { location: "https://evil.example/x" } })),
    /photo-redirect/,
  );
  await assert.rejects(downloadListingPhoto("https://evil.example/sofa.jpg", async () => new Response("no")), /photo-host/);
});

test("the model image is a JPEG no wider or taller than 768 pixels", async () => {
  const big = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: { r: 180, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
  const out = await resizeListingPhoto(new Uint8Array(big));
  const meta = await sharp(Buffer.from(out)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok((meta.width ?? 0) > 0);
  assert.ok((meta.width ?? 0) <= LISTING_PHOTO_MAX_PX);
  assert.ok((meta.height ?? 0) <= LISTING_PHOTO_MAX_PX);
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xd8);

  const small = await sharp({
    create: { width: 120, height: 80, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  const kept = await resizeListingPhoto(new Uint8Array(small));
  const smallMeta = await sharp(Buffer.from(kept)).metadata();
  assert.equal(smallMeta.format, "jpeg");
  assert.equal(smallMeta.width, 120);
  assert.equal(smallMeta.height, 80);
});
