import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintPublicVideoThumb } from "@/lib/ai/moderation";
import type { FlagDraft, HashDraft } from "@/lib/ai/moderation";
import type { HashCandidate } from "@/lib/ai/photo-hash";
import {
  downloadPublicMuxThumbnail,
  isPublicMuxThumbnailUrl,
  publicMuxThumbnailUrl,
  publicVideoThumbTargets,
  type PublicVideoThumbInput,
} from "@/lib/ai/video-thumb";

const playback = "PublicPlaybackId1";
const thumb = `https://image.mux.com/${playback}/thumbnail.jpg`;

const live: PublicVideoThumbInput = {
  id: "video_1",
  status: "approved",
  publicPlaybackId: playback,
  published: true,
  verifiedPro: true,
  ownerUser: "seller_1",
};

test("a public thumbnail URL is the plain Mux jpg and nothing else", () => {
  assert.equal(publicMuxThumbnailUrl(playback), thumb);
  assert.equal(publicMuxThumbnailUrl(`  ${playback}  `), thumb);
  assert.equal(isPublicMuxThumbnailUrl(thumb), true);
  assert.equal(publicMuxThumbnailUrl(""), null);
  assert.equal(publicMuxThumbnailUrl("../etc"), null);
  assert.equal(publicMuxThumbnailUrl(`${playback}/extra`), null);
  assert.equal(isPublicMuxThumbnailUrl(`http://image.mux.com/${playback}/thumbnail.jpg`), false);
  assert.equal(isPublicMuxThumbnailUrl(`https://user:pass@image.mux.com/${playback}/thumbnail.jpg`), false);
  assert.equal(isPublicMuxThumbnailUrl(`https://evil.example/${playback}/thumbnail.jpg`), false);
  assert.equal(isPublicMuxThumbnailUrl(`${thumb}?time=1&width=1280`), false);
  assert.equal(isPublicMuxThumbnailUrl(`${thumb}?token=signed`), false);
  assert.equal(isPublicMuxThumbnailUrl("https://store.public.blob.vercel-storage.com/sofa.jpg"), false);
});

test("only an approved public shop video is queued for a thumbnail fingerprint", () => {
  assert.deepEqual(publicVideoThumbTargets([live]), [
    { ownerType: "video", ownerId: "video_1", url: thumb, ownerUser: "seller_1" },
  ]);
  assert.deepEqual(publicVideoThumbTargets([{ ...live, status: "pending", publicPlaybackId: "" }]), []);
  assert.deepEqual(publicVideoThumbTargets([{ ...live, status: "pending" }]), []);
  assert.deepEqual(publicVideoThumbTargets([{ ...live, verifiedPro: false }]), []);
  assert.deepEqual(publicVideoThumbTargets([{ ...live, published: false }]), []);
  assert.deepEqual(publicVideoThumbTargets([{ ...live, publicPlaybackId: "signed/id" }]), []);
  assert.deepEqual(publicVideoThumbTargets([{ ...live, ownerUser: " " }]), []);
});

test("a Mux thumbnail download refuses redirects and other hosts", async () => {
  await assert.rejects(
    downloadPublicMuxThumbnail(thumb, async () => new Response(null, { status: 302, headers: { location: "https://evil.example/x" } })),
    /thumb-redirect/,
  );
  await assert.rejects(
    downloadPublicMuxThumbnail(`${thumb}?token=signed`, async () => new Response("no")),
    /thumb-host/,
  );
  const bytes = await downloadPublicMuxThumbnail(thumb, async () => new Response(new Uint8Array([1, 2, 3])));
  assert.deepEqual(Array.from(bytes), [1, 2, 3]);
});

test("another seller's thumbnail is a duplicate_video flag and the same seller is stored only", async () => {
  const saved: FlagDraft[] = [];
  const fingerprints: HashDraft[] = [];
  const other: HashCandidate[] = [
    { ownerType: "video", ownerId: "video_older", ownerUser: "seller_2", dhash: "0000000000000001" },
  ];
  const flagged = await fingerprintPublicVideoThumb({
    videoId: "video_1",
    url: thumb,
    ownerUser: "seller_1",
    env: { MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv,
    hashes: other,
    download: async () => new Uint8Array([9]),
    fingerprint: async () => "0000000000000000",
    saveFlag: async (row) => {
      saved.push(row);
    },
    saveHash: async (row) => {
      fingerprints.push(row);
    },
  });
  assert.deepEqual(flagged, { hashed: true, flagged: true });
  assert.equal(fingerprints[0]?.mediaType, "video_thumb");
  assert.equal(fingerprints[0]?.ownerType, "video");
  assert.equal(saved[0]?.kind, "duplicate_video");
  assert.equal(saved[0]?.targetType, "video");
  assert.equal(saved[0]?.source, "phash");
  assert.equal(saved[0]?.status, "open");

  const ownSaved: FlagDraft[] = [];
  const own = await fingerprintPublicVideoThumb({
    videoId: "video_1",
    url: thumb,
    ownerUser: "seller_1",
    env: { MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv,
    hashes: [{ ownerType: "listing", ownerId: "listing_mine", ownerUser: "seller_1", dhash: "0000000000000001" }],
    download: async () => new Uint8Array([9]),
    fingerprint: async () => "0000000000000000",
    saveFlag: async (row) => {
      ownSaved.push(row);
    },
    saveHash: async () => undefined,
  });
  assert.deepEqual(own, { hashed: true, flagged: false });
  assert.equal(ownSaved.length, 0);
});

test("signed thumbnails and a switched-off fingerprint flag are skipped", async () => {
  let downloaded = 0;
  const signed = await fingerprintPublicVideoThumb({
    videoId: "video_1",
    url: `${thumb}?token=signed`,
    ownerUser: "seller_1",
    env: { MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv,
    download: async () => {
      downloaded += 1;
      return new Uint8Array([1]);
    },
  });
  const off = await fingerprintPublicVideoThumb({
    videoId: "video_1",
    url: thumb,
    ownerUser: "seller_1",
    env: {} as NodeJS.ProcessEnv,
    download: async () => {
      downloaded += 1;
      return new Uint8Array([1]);
    },
  });
  assert.deepEqual(signed, { hashed: false, flagged: false });
  assert.deepEqual(off, { hashed: false, flagged: false });
  assert.equal(downloaded, 0);
});
