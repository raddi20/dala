import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { encodeVariants } from "@/lib/image-thumbs";
import {
  backfillMode,
  blobHost,
  cardPhoto,
  isVariantComplete,
  thumbsNeeded,
  variantPathname,
} from "@/lib/image-variants";

const SOURCE = "https://yypodf6rvjgwdxyk.public.blob.vercel-storage.com/users/abc/listing-photo.jpg";

test("variant pathnames sit beside the original and refuse a bad address", () => {
  assert.equal(
    variantPathname(SOURCE, 480),
    "users/abc/listing-photo.w480.webp",
  );
  assert.equal(variantPathname(SOURCE, 960), "users/abc/listing-photo.w960.webp");
  assert.equal(variantPathname("not a url", 480), null);
  assert.equal(variantPathname("http://evil.example/a.jpg", 480), null);
  assert.equal(variantPathname("https://cdn.example/../secret.jpg", 480), null);
  assert.equal(blobHost(SOURCE), true);
  assert.equal(blobHost("https://images.unsplash.com/photo"), false);
});

test("srcset uses stored thumbs, otherwise a sized Unsplash WebP, and sets dimensions", () => {
  const stored = cardPhoto({
    src: SOURCE,
    thumb480: "https://cdn.example/a.w480.webp",
    thumb960: "https://cdn.example/a.w960.webp",
    width: 480,
    height: 300,
    priority: true,
  });
  assert.ok(stored);
  assert.equal(stored.src, "https://cdn.example/a.w480.webp");
  assert.match(stored.srcSet ?? "", /480w/);
  assert.match(stored.srcSet ?? "", /960w/);
  assert.equal(stored.width, 480);
  assert.equal(stored.height, 300);
  assert.equal(stored.loading, "eager");
  assert.equal(stored.decoding, "async");
  assert.equal(stored.fetchPriority, "high");

  const plain = cardPhoto({ src: SOURCE, width: 16, height: 10 });
  assert.equal(plain?.src, SOURCE);
  assert.equal(plain?.srcSet, undefined);
  assert.equal(plain?.loading, "lazy");

  const seed = cardPhoto({
    src: "https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1200&q=80",
    width: 480,
    height: 300,
  });
  assert.match(seed?.src ?? "", /w=480/);
  assert.match(seed?.src ?? "", /fm=webp/);
  assert.match(seed?.srcSet ?? "", /w=960/);
  assert.equal(cardPhoto({ src: "  ", width: 1, height: 1 }), null);
});

test("the backfill is a dry run unless --apply is set, and production needs an extra yes", () => {
  assert.equal(backfillMode(false, false, false), "dry-run");
  assert.equal(backfillMode(false, true, false), "dry-run");
  assert.equal(backfillMode(true, false, false), "apply");
  assert.equal(backfillMode(true, true, false), "refuse");
  assert.equal(backfillMode(true, true, true), "apply");
});

test("a finished variant row is left alone, and a small original needs no thumb", () => {
  assert.deepEqual(thumbsNeeded(320), []);
  assert.deepEqual(thumbsNeeded(700), [480]);
  assert.deepEqual(thumbsNeeded(1600), [480, 960]);
  assert.equal(isVariantComplete(null), false);
  assert.equal(isVariantComplete({ thumb480: null, thumb960: null, longest: null }), false);
  assert.equal(isVariantComplete({ thumb480: null, thumb960: null, longest: 400 }), true);
  assert.equal(isVariantComplete({ thumb480: "https://cdn.example/a.w480.webp", thumb960: null, longest: 700 }), true);
  assert.equal(isVariantComplete({ thumb480: null, thumb960: null, longest: 700 }), false);
  assert.equal(
    isVariantComplete({
      thumb480: "https://cdn.example/a.w480.webp",
      thumb960: "https://cdn.example/a.w960.webp",
      longest: 1600,
    }),
    true,
  );
});

test("sharp writes 480 and 960 WebP and does not upscale or re-encode the original", async () => {
  const original = await sharp({
    create: { width: 1400, height: 900, channels: 3, background: "#c8881a" },
  })
    .webp({ quality: 80 })
    .toBuffer();

  const encoded = await encodeVariants(original, SOURCE, null);
  assert.equal(encoded.skipped, false);
  assert.equal(encoded.longest, 1400);
  assert.deepEqual(
    encoded.uploads.map((file) => file.edge),
    [480, 960],
  );
  for (const file of encoded.uploads) {
    assert.ok(file.buffer.length < original.length);
    const meta = await sharp(file.buffer).metadata();
    assert.equal(meta.format, "webp");
    assert.ok((meta.width ?? 0) <= file.edge);
    assert.ok((meta.height ?? 0) <= file.edge);
    assert.equal(Math.max(meta.width ?? 0, meta.height ?? 0), file.edge);
  }

  const again = await encodeVariants(original, SOURCE, {
    thumb480: "https://cdn.example/a.w480.webp",
    thumb960: "https://cdn.example/a.w960.webp",
    longest: 1400,
  });
  assert.equal(again.skipped, true);
  assert.equal(again.uploads.length, 0);

  const small = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#1a2436" },
  })
    .webp()
    .toBuffer();
  const skipped = await encodeVariants(small, SOURCE, null);
  assert.equal(skipped.uploads.length, 0);
  assert.equal(skipped.longest, 300);
});
