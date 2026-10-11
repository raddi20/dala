import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../next.config";
import {
  ALLOWED_REMOTE_IMAGE_HOSTS,
  MUX_THUMBNAIL_HOST,
  RANGACH_BLOB_HOST,
  isAllowedRemoteImageHost,
  isAllowedRemoteImageUrl,
  ogPhotoSource,
  remoteImagePatterns,
} from "./image-hosts";

const blob = `https://${RANGACH_BLOB_HOST}/users/abc/listing-photo.jpg`;
const mux = `https://${MUX_THUMBNAIL_HOST}/playbackId/thumbnail.jpg?time=1`;

test("remote image allowlist is the Rangach Blob store and Mux thumbnails", () => {
  assert.deepEqual(ALLOWED_REMOTE_IMAGE_HOSTS, [RANGACH_BLOB_HOST, MUX_THUMBNAIL_HOST]);
  assert.equal(isAllowedRemoteImageHost(RANGACH_BLOB_HOST), true);
  assert.equal(isAllowedRemoteImageHost(`${RANGACH_BLOB_HOST}.`), true);
  assert.equal(isAllowedRemoteImageHost(RANGACH_BLOB_HOST.toUpperCase()), true);
  assert.equal(isAllowedRemoteImageHost(MUX_THUMBNAIL_HOST), true);
  assert.equal(isAllowedRemoteImageUrl(blob), true);
  assert.equal(isAllowedRemoteImageUrl(mux), true);
});

test("remote image allowlist rejects other hosts, schemes, and credentials", () => {
  const rejected = [
    "http://yypodf6rvjgwdxyk.public.blob.vercel-storage.com/a.jpg",
    "https://user:pass@yypodf6rvjgwdxyk.public.blob.vercel-storage.com/a.jpg",
    "https://yypodf6rvjgwdxyk.public.blob.vercel-storage.com:8443/a.jpg",
    "https://store.public.blob.vercel-storage.com/sofa.jpg",
    "https://blob.vercel-storage.com/sofa.jpg",
    "https://evil.yypodf6rvjgwdxyk.public.blob.vercel-storage.com/a.jpg",
    "https://yypodf6rvjgwdxyk.public.blob.vercel-storage.com.evil.test/a.jpg",
    "https://stream.mux.com/playback.m3u8",
    "https://image.mux.com.evil.test/thumbnail.jpg",
    "https://images.unsplash.com/photo-1",
    "https://127.0.0.1/a.jpg",
    "https://169.254.169.254/latest/meta-data",
    "http://localhost/a.jpg",
    "data:image/png;base64,aaaa",
    "javascript:alert(1)",
    "/listings/photo.jpg",
    "",
  ];
  for (const url of rejected) {
    assert.equal(isAllowedRemoteImageUrl(url), false, url);
  }
  assert.equal(isAllowedRemoteImageHost("*.public.blob.vercel-storage.com"), false);
  assert.equal(isAllowedRemoteImageHost("*.mux.com"), false);
});

test("OG photos fall back to nothing unless the host is allowed", () => {
  assert.equal(ogPhotoSource(blob), blob);
  assert.equal(ogPhotoSource(`  ${mux}  `), mux);
  assert.equal(ogPhotoSource("/mock/shop-poster.jpg"), "/mock/shop-poster.jpg");
  assert.equal(ogPhotoSource("/mock/../.env"), "");
  assert.equal(ogPhotoSource("/hero.svg"), "");
  assert.equal(ogPhotoSource("https://images.unsplash.com/photo-1?w=1200"), "");
  assert.equal(ogPhotoSource("https://cdn.example/cover.jpg"), "");
  assert.equal(ogPhotoSource(""), "");
});

test("next.config image remotePatterns are the allowlist and contain no wildcards", () => {
  const patterns = nextConfig.images?.remotePatterns ?? [];
  assert.deepEqual(
    patterns.map((pattern) => pattern.hostname),
    [...ALLOWED_REMOTE_IMAGE_HOSTS],
  );
  assert.deepEqual(remoteImagePatterns(), patterns);
  for (const pattern of patterns) {
    assert.equal(pattern.protocol, "https");
    assert.equal(pattern.hostname.includes("*"), false);
    assert.equal(JSON.stringify(pattern).includes("*"), false);
  }
});
