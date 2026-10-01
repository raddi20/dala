import assert from "node:assert/strict";
import test from "node:test";
import Mux from "@mux/mux-node";
import sharp from "sharp";
import { POST } from "@/app/api/mux/webhook/route";
import { prisma } from "@/lib/prisma";
import { buildShareMetadata, shopPreviewImage } from "@/lib/share-metadata";
import { staticPublicPaths } from "@/lib/sitemap-entries";
import type { VideoBackend } from "@/lib/video/backend";
import { playbackReferrerDomains, videoMode } from "@/lib/video/config";
import {
  decideReady,
  planReviewDecision,
  planUpload,
  shopVideoIsPublic,
} from "@/lib/video/machine";
import { jpegUnderLimit, OG_JPEG_LIMIT } from "@/lib/video/og-jpeg";
import { muxSignatureHex, verifyMuxSignature } from "@/lib/video/signature";
import {
  approveShopVideo,
  createShopVideoUpload,
  handleMuxEvent,
  rejectShopVideo,
  removeLiveShopVideo,
} from "@/lib/video/service";

const secret = "whsec_test_secret_value";

function fakeBackend() {
  const deleted: string[] = [];
  const backend: VideoBackend = {
    kind: "mock",
    async createDirectUpload({ passthrough }) {
      return { uploadId: `up_${passthrough}`, url: "https://uploads.example.test/file" };
    },
    async ensurePlaybackRestriction() {
      return "restrict_1";
    },
    async addPublicPlayback({ assetId }) {
      return `pub_${assetId}`;
    },
    async signReviewTokens() {
      return { playback: "play", thumbnail: "thumb" };
    },
    async deleteAsset(assetId) {
      deleted.push(assetId);
    },
    async requestModeration() {
      return undefined;
    },
  };
  return { backend, deleted };
}

async function makeShop(verifiedPro: boolean, role: "user" | "admin" = "user") {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = await prisma.user.create({
    data: {
      email: `video-${stamp}@example.com`,
      name: "Video Seller",
      passwordHash: "x",
      city: "Nairobi",
      role,
      verifiedPro,
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `video-admin-${stamp}@example.com`,
      name: "Video Admin",
      passwordHash: "x",
      city: "Nairobi",
      role: "admin",
    },
  });
  const shop = await prisma.storefront.create({
    data: { userId: owner.id, slug: `video-shop-${stamp}`, published: true },
  });
  return { owner, admin, shop, stamp };
}

async function removeShop(ownerId: string, adminId: string) {
  await prisma.user.delete({ where: { id: ownerId } });
  await prisma.user.delete({ where: { id: adminId } });
}

const uploadBase = {
  consent: true,
  fileName: "clip.mp4",
  mimeType: "video/mp4",
  sizeBytes: 8_000_000,
  durationSeconds: 20,
  caption: " Nyama choma on the grill ",
  recentUploads: 0,
  inFlight: false,
  adminExempt: false,
  verifiedPro: true,
};

test("only a Pro shop can plan an upload, and consent, size, length, and the daily limit apply", () => {
  const blocked = planUpload({ ...uploadBase, verifiedPro: false });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "pro");

  const consent = planUpload({ ...uploadBase, consent: false });
  assert.equal(consent.ok, false);
  if (!consent.ok) assert.equal(consent.code, "consent");

  const huge = planUpload({ ...uploadBase, sizeBytes: 201 * 1024 * 1024 });
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.equal(huge.code, "size");

  const long = planUpload({ ...uploadBase, durationSeconds: 46 });
  assert.equal(long.ok, false);
  if (!long.ok) assert.equal(long.code, "duration");

  const hevc = planUpload({ ...uploadBase, fileName: "IMG_1.MOV", mimeType: "video/quicktime" });
  assert.equal(hevc.ok, true);

  const rate = planUpload({ ...uploadBase, recentUploads: 1 });
  assert.equal(rate.ok, false);
  if (!rate.ok) assert.equal(rate.code, "rate");

  const admin = planUpload({ ...uploadBase, recentUploads: 3, adminExempt: true });
  assert.equal(admin.ok, true);

  const waiting = planUpload({ ...uploadBase, inFlight: true, adminExempt: true });
  assert.equal(waiting.ok, false);
  if (!waiting.ok) assert.equal(waiting.code, "inflight");
});

test("a non-admin cannot approve, reject, or remove a video", () => {
  for (const action of ["approve", "reject", "remove"] as const) {
    const result = planReviewDecision({ role: "user", status: action === "remove" ? "approved" : "pending", action, reason: "Not allowed" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "forbidden");
  }
  const missing = planReviewDecision({ role: "admin", status: "pending", action: "reject", reason: " " });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "invalid");
});

test("a lapsed Pro plan hides an approved video and does not delete the idea of it", () => {
  const live = {
    verifiedPro: true,
    published: true,
    status: "approved",
    publicPlaybackId: "pub_1",
  };
  assert.equal(shopVideoIsPublic(live), true);
  assert.equal(shopVideoIsPublic({ ...live, verifiedPro: false }), false);
  assert.equal(shopVideoIsPublic({ ...live, status: "pending", publicPlaybackId: "" }), false);
});

test("webhook signatures match the Mux SDK, and stale or wrong signatures fail", async () => {
  const body = JSON.stringify({ id: "evt_1", type: "video.asset.ready", data: { id: "asset_1" } });
  const timestamp = Math.floor(Date.now() / 1000);
  const header = `t=${timestamp},v1=${muxSignatureHex(timestamp, body, secret)}`;
  assert.deepEqual(verifyMuxSignature(body, header, secret), { ok: true });

  const mux = new Mux({ tokenId: "token", tokenSecret: "secret" });
  await mux.webhooks.verifySignature(body, { "mux-signature": header }, secret);

  const wrong = verifyMuxSignature(body, header, "other-secret");
  assert.equal(wrong.ok, false);
  const stale = verifyMuxSignature(body, `t=${timestamp - 301},v1=${muxSignatureHex(timestamp - 301, body, secret)}`, secret);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.match(stale.error, /too old/i);
  const missing = verifyMuxSignature(body, null, secret);
  assert.equal(missing.ok, false);

  await assert.rejects(() => mux.webhooks.verifySignature(body, { "mux-signature": header }, "other-secret"));
});

test("a clip over 45 seconds is rejected from Mux metadata", () => {
  assert.equal(decideReady({ status: "processing" }, { durationSeconds: 45.2, playbackId: "p" }).action, "pending");
  assert.equal(decideReady({ status: "processing" }, { durationSeconds: 45.6, playbackId: "p" }).action, "too_long");
  assert.equal(decideReady({ status: "approved" }, { durationSeconds: 80, playbackId: "p" }).action, "ignore");
});

test("referrer domains include the site, the www and apex pair, and localhost", () => {
  const domains = playbackReferrerDomains({ APP_URL: "https://www.rangach.co.ke" });
  assert.ok(domains.includes("www.rangach.co.ke"));
  assert.ok(domains.includes("rangach.co.ke"));
  assert.ok(domains.includes("localhost"));
  assert.equal(domains.includes("*"), false);
});

test("missing Mux keys hide the feature, and mock mode does not become live", () => {
  assert.equal(videoMode({}), "off");
  assert.equal(videoMode({ MUX_TOKEN_ID: "id", MUX_TOKEN_SECRET: "secret" }), "live");
  assert.equal(videoMode({ MUX_TOKEN_ID: "id", MUX_TOKEN_SECRET: "secret", MUX_MOCK: "1" }), "mock");
});

test("a public video uses the poster card and does not set og:video", () => {
  const preview = shopPreviewImage({
    origin: "https://www.rangach.co.ke",
    slug: "okello-and-co",
    published: true,
    verifiedPro: true,
    bannerUrl: "https://cdn.example/cover.jpg",
    avatarUrl: "",
    hasPublicVideo: true,
  });
  assert.equal(preview?.url, "https://www.rangach.co.ke/b/okello-and-co/video-card");
  assert.equal(preview?.contentType, "image/jpeg");
  const meta = buildShareMetadata({
    origin: "https://www.rangach.co.ke",
    path: "/b/okello-and-co",
    title: "Okello",
    description: "Shop",
    image: preview?.url ?? "",
    imageAlt: "Okello",
    imageType: preview?.contentType,
  });
  assert.equal(meta.openGraph && "videos" in meta.openGraph ? meta.openGraph.videos : undefined, undefined);
  assert.ok(staticPublicPaths().some((item) => item.path === "/video-policy"));
});

test("the share image stays under 600 KB", async () => {
  const raw = Buffer.alloc(1200 * 630 * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 17) % 256;
  const noisy = await sharp(raw, { raw: { width: 1200, height: 630, channels: 3 } }).png().toBuffer();
  const jpeg = await jpegUnderLimit(noisy);
  assert.ok(jpeg.byteLength <= OG_JPEG_LIMIT);
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
});

test("Pro gating blocks the upload before a row is written", async () => {
  const { owner, admin, shop } = await makeShop(false);
  const { backend } = fakeBackend();
  try {
    const denied = await createShopVideoUpload(prisma, backend, {
      actor: { id: owner.id, role: owner.role, verifiedPro: false },
      storefrontId: shop.id,
      corsOrigin: "http://localhost:3000",
      consent: true,
      fileName: "clip.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1000,
      durationSeconds: 10,
      caption: "Kitchen",
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "pro");
    assert.equal(await prisma.shopVideo.count({ where: { storefrontId: shop.id } }), 0);
    assert.equal(await prisma.shopVideoEvent.count({ where: { storefrontId: shop.id } }), 0);
  } finally {
    await removeShop(owner.id, admin.id);
  }
});

test("upload, review, approval, webhook idempotency, and a replacement that keeps the old video live", async () => {
  const { owner, admin, shop } = await makeShop(true);
  const { backend, deleted } = fakeBackend();
  const actor = { id: admin.id, email: admin.email, name: admin.name };
  const receipts = ["evt_created_a", "evt_ready_a", "evt_ready_a_again", "evt_ready_b", "evt_created_b"];
  try {
    const created = await createShopVideoUpload(prisma, backend, {
      actor: { id: owner.id, role: "user", verifiedPro: true },
      storefrontId: shop.id,
      corsOrigin: "http://localhost:3000",
      consent: true,
      fileName: "grill.mov",
      mimeType: "video/quicktime",
      sizeBytes: 4_000_000,
      durationSeconds: 18,
      caption: "Grill",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const first = await prisma.shopVideo.findUniqueOrThrow({ where: { id: created.videoId } });
    assert.equal(first.status, "uploading");
    assert.ok(first.consentAt);
    assert.equal(first.publicPlaybackId, "");

    const createdEvent = await handleMuxEvent(prisma, backend, {
      eventId: "evt_created_a",
      type: "video.upload.asset_created",
      data: { id: first.uploadId, asset_id: "asset_a" },
    });
    assert.deepEqual(createdEvent, { ok: true, duplicate: false });
    const ready = await handleMuxEvent(prisma, backend, {
      eventId: "evt_ready_a",
      type: "video.asset.ready",
      data: { id: "asset_a", upload_id: first.uploadId, duration: 18.2, playback_ids: [{ id: "signed_a", policy: "signed" }] },
    });
    assert.deepEqual(ready, { ok: true, duplicate: false });
    const duplicate = await handleMuxEvent(prisma, backend, {
      eventId: "evt_ready_a",
      type: "video.asset.ready",
      data: { id: "asset_a", upload_id: first.uploadId, duration: 18.2, playback_ids: [{ id: "signed_a", policy: "signed" }] },
    });
    assert.deepEqual(duplicate, { ok: true, duplicate: true });

    const pending = await prisma.shopVideo.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(pending.status, "pending");
    assert.equal(pending.playbackId, "signed_a");
    assert.equal(pending.publicPlaybackId, "");
    assert.equal(shopVideoIsPublic({ verifiedPro: true, published: true, status: pending.status, publicPlaybackId: pending.publicPlaybackId }), false);

    const forbidden = await approveShopVideo(prisma, backend, {
      role: "user",
      videoId: first.id,
      admin: actor,
    });
    assert.equal(forbidden.ok, false);
    if (!forbidden.ok) assert.equal(forbidden.code, "forbidden");
    assert.equal((await prisma.shopVideo.findUniqueOrThrow({ where: { id: first.id } })).status, "pending");

    const approved = await approveShopVideo(prisma, backend, { role: "admin", videoId: first.id, admin: actor });
    assert.equal(approved.ok, true);
    const live = await prisma.shopVideo.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(live.status, "approved");
    assert.equal(live.publicPlaybackId, "pub_asset_a");
    assert.equal(shopVideoIsPublic({ verifiedPro: true, published: true, status: live.status, publicPlaybackId: live.publicPlaybackId }), true);

    const tooSoon = await createShopVideoUpload(prisma, backend, {
      actor: { id: owner.id, role: "user", verifiedPro: true },
      storefrontId: shop.id,
      corsOrigin: "http://localhost:3000",
      consent: true,
      fileName: "other.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1000,
      durationSeconds: 8,
      caption: "Too soon",
    });
    assert.equal(tooSoon.ok, false);
    if (!tooSoon.ok) assert.equal(tooSoon.code, "rate");

    await prisma.shopVideo.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });
    const replacement = await createShopVideoUpload(prisma, backend, {
      actor: { id: owner.id, role: "user", verifiedPro: true },
      storefrontId: shop.id,
      corsOrigin: "http://localhost:3000",
      consent: true,
      fileName: "new.mp4",
      mimeType: "video/mp4",
      sizeBytes: 2_000_000,
      durationSeconds: 12,
      caption: "New grill",
    });
    assert.equal(replacement.ok, true);
    if (!replacement.ok) return;
    const second = await prisma.shopVideo.findUniqueOrThrow({ where: { id: replacement.videoId } });
    await handleMuxEvent(prisma, backend, {
      eventId: "evt_created_b",
      type: "video.upload.asset_created",
      data: { id: second.uploadId, asset_id: "asset_b" },
    });
    await handleMuxEvent(prisma, backend, {
      eventId: "evt_ready_b",
      type: "video.asset.ready",
      data: { id: "asset_b", upload_id: second.uploadId, duration: 12, playback_ids: [{ id: "signed_b", policy: "signed" }] },
    });

    const stillLive = await prisma.shopVideo.findFirstOrThrow({ where: { storefrontId: shop.id, status: "approved" } });
    assert.equal(stillLive.id, first.id);
    assert.equal((await prisma.shopVideo.findUniqueOrThrow({ where: { id: second.id } })).status, "pending");

    const swapped = await approveShopVideo(prisma, backend, { role: "admin", videoId: second.id, admin: actor });
    assert.equal(swapped.ok, true);
    const oldRow = await prisma.shopVideo.findUniqueOrThrow({ where: { id: first.id } });
    const newRow = await prisma.shopVideo.findUniqueOrThrow({ where: { id: second.id } });
    assert.equal(oldRow.status, "replaced");
    assert.equal(oldRow.publicPlaybackId, "");
    assert.equal(newRow.status, "approved");
    assert.equal(newRow.publicPlaybackId, "pub_asset_b");
    assert.ok(deleted.includes("asset_a"));

    const events = await prisma.shopVideoEvent.findMany({ where: { storefrontId: shop.id }, orderBy: { createdAt: "asc" } });
    assert.ok(events.some((event) => event.action === "approve" && event.adminId === admin.id && event.videoId === second.id));
    assert.ok(events.some((event) => event.action === "replace" && event.adminEmail === admin.email));
    const approveCount = events.filter((event) => event.action === "approve" && event.videoId === first.id).length;
    assert.equal(approveCount, 1);
  } finally {
    await prisma.muxEventReceipt.deleteMany({ where: { id: { in: receipts } } });
    await removeShop(owner.id, admin.id);
  }
});

test("an over-length Mux asset is deleted, and a non-admin rejection writes nothing", async () => {
  const { owner, admin, shop } = await makeShop(true);
  const { backend, deleted } = fakeBackend();
  try {
    const created = await createShopVideoUpload(prisma, backend, {
      actor: { id: owner.id, role: "admin", verifiedPro: true },
      storefrontId: shop.id,
      corsOrigin: "http://localhost:3000",
      consent: true,
      fileName: "long.mp4",
      mimeType: "video/mp4",
      sizeBytes: 9_000_000,
      durationSeconds: null,
      caption: "",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const video = await prisma.shopVideo.findUniqueOrThrow({ where: { id: created.videoId } });
    await handleMuxEvent(prisma, backend, {
      eventId: `evt_long_${shop.id}`,
      type: "video.asset.ready",
      data: { id: "asset_long", upload_id: video.uploadId, duration: 50, playback_ids: [{ id: "signed_long", policy: "signed" }] },
    });
    const after = await prisma.shopVideo.findUniqueOrThrow({ where: { id: video.id } });
    assert.equal(after.status, "rejected");
    assert.match(after.rejectReason, /45/);
    assert.ok(deleted.includes("asset_long"));
    assert.ok(after.muxDeletedAt);

    const rejected = await rejectShopVideo(prisma, {
      role: "user",
      videoId: video.id,
      reason: "Seller trying to reject their own video",
      admin: { id: admin.id, email: admin.email, name: admin.name },
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.code, "forbidden");
  } finally {
    await prisma.muxEventReceipt.deleteMany({ where: { id: `evt_long_${shop.id}` } });
    await removeShop(owner.id, admin.id);
  }
});

test("reject and remove are admin-only and keep an audit note", async () => {
  const { owner, admin, shop } = await makeShop(true);
  const { backend, deleted } = fakeBackend();
  const actor = { id: admin.id, email: admin.email, name: admin.name };
  try {
    const video = await prisma.shopVideo.create({
      data: {
        storefrontId: shop.id,
        status: "pending",
        uploadId: `up_${shop.id}`,
        assetId: `asset_${shop.id}`,
        playbackId: "signed",
        consentAt: new Date(),
      },
    });
    const denied = await rejectShopVideo(prisma, {
      role: owner.role,
      videoId: video.id,
      reason: "No thanks",
      admin: actor,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "forbidden");
    assert.equal(await prisma.shopVideoEvent.count({ where: { videoId: video.id } }), 0);

    const rejected = await rejectShopVideo(prisma, {
      role: "admin",
      videoId: video.id,
      reason: "Music the shop does not own.",
      admin: actor,
    });
    assert.equal(rejected.ok, true);
    const row = await prisma.shopVideo.findUniqueOrThrow({ where: { id: video.id } });
    assert.equal(row.status, "rejected");
    assert.ok(row.purgeAfter);
    assert.equal(row.muxDeletedAt, null);
    const event = await prisma.shopVideoEvent.findFirstOrThrow({ where: { videoId: video.id } });
    assert.equal(event.action, "reject");
    assert.equal(event.note, "Music the shop does not own.");
    assert.equal(event.adminId, admin.id);

    const live = await prisma.shopVideo.create({
      data: {
        storefrontId: shop.id,
        status: "approved",
        assetId: `live_${shop.id}`,
        publicPlaybackId: "pub_live",
        playbackId: "signed_live",
      },
    });
    const removed = await removeLiveShopVideo(prisma, backend, {
      role: "admin",
      videoId: live.id,
      reason: "Takedown requested.",
      admin: actor,
    });
    assert.equal(removed.ok, true);
    const gone = await prisma.shopVideo.findUniqueOrThrow({ where: { id: live.id } });
    assert.equal(gone.status, "rejected");
    assert.equal(gone.publicPlaybackId, "");
    assert.ok(deleted.includes(`live_${shop.id}`));
    assert.equal(shopVideoIsPublic({ verifiedPro: true, published: true, status: gone.status, publicPlaybackId: gone.publicPlaybackId }), false);
  } finally {
    await removeShop(owner.id, admin.id);
  }
});

test("the webhook route rejects a bad signature and ignores a duplicate delivery", async () => {
  const previousMock = process.env.MUX_MOCK;
  const previousSecret = process.env.MUX_WEBHOOK_SECRET;
  process.env.MUX_MOCK = "1";
  process.env.MUX_WEBHOOK_SECRET = secret;
  const eventId = `evt_route_${Date.now()}`;
  const body = JSON.stringify({ id: eventId, type: "video.upload.cancelled", data: { id: "missing-upload" } });
  const timestamp = Math.floor(Date.now() / 1000);
  const header = `t=${timestamp},v1=${muxSignatureHex(timestamp, body, secret)}`;
  try {
    const bad = await POST(
      new Request("http://localhost/api/mux/webhook", {
        method: "POST",
        headers: { "mux-signature": "t=1,v1=nope", "content-type": "application/json" },
        body,
      }),
    );
    assert.equal(bad.status, 401);

    const ok = await POST(
      new Request("http://localhost/api/mux/webhook", {
        method: "POST",
        headers: { "mux-signature": header, "content-type": "application/json" },
        body,
      }),
    );
    assert.equal(ok.status, 200);
    const first = (await ok.json()) as { duplicate: boolean };
    assert.equal(first.duplicate, false);

    const repeat = await POST(
      new Request("http://localhost/api/mux/webhook", {
        method: "POST",
        headers: { "mux-signature": header, "content-type": "application/json" },
        body,
      }),
    );
    assert.equal(repeat.status, 200);
    const second = (await repeat.json()) as { duplicate: boolean };
    assert.equal(second.duplicate, true);
    assert.equal(await prisma.muxEventReceipt.count({ where: { id: eventId } }), 1);
  } finally {
    await prisma.muxEventReceipt.deleteMany({ where: { id: eventId } });
    if (previousMock === undefined) delete process.env.MUX_MOCK;
    else process.env.MUX_MOCK = previousMock;
    if (previousSecret === undefined) delete process.env.MUX_WEBHOOK_SECRET;
    else process.env.MUX_WEBHOOK_SECRET = previousSecret;
  }
});
