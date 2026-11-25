import assert from "node:assert/strict";
import test from "node:test";
import { tipEmailText } from "@/lib/ai/seller-tips";
import { runVisibilityTips, visibilityEmailText, type VisibilitySeller } from "@/lib/seller-mail/visibility";
import { computeShopGaps } from "@/lib/seller-mail/gaps";
import {
  SHOP_VIDEO_EDITOR_PATH,
  VIDEO_TIP_PRO_NOTE,
  VIDEO_TIP_TITLE,
  shopVideoEditorUrl,
  videoTipKind,
  videoTipLines,
} from "@/lib/seller-mail/video-tip";
import { safePath } from "@/lib/utils";

const base = { videoMode: "live" as const, proActive: true, paymentsLive: false, videos: [] as { status: string }[] };

test("a Pro shop with no video gets the upload tip", () => {
  assert.equal(videoTipKind(base), "upload");
  assert.equal(videoTipKind({ ...base, videos: [{ status: "rejected" }, { status: "errored" }, { status: "replaced" }] }), "upload");
});

test("a shop with a live or in-review video gets no tip", () => {
  for (const status of ["approved", "uploading", "processing", "pending"]) {
    assert.equal(videoTipKind({ ...base, videos: [{ status }] }), null, status);
    assert.equal(videoTipKind({ ...base, proActive: false, paymentsLive: true, videos: [{ status }] }), null, status);
  }
});

test("a free shop only hears about video when checkout is live, and is told it is Pro", () => {
  assert.equal(videoTipKind({ ...base, proActive: false, paymentsLive: false }), null);
  assert.equal(videoTipKind({ ...base, proActive: false, paymentsLive: true }), "pro");
  const lines = videoTipLines("pro", "https://www.rangach.co.ke");
  assert.ok(lines.includes(VIDEO_TIP_PRO_NOTE));
  assert.equal(videoTipLines("upload", "https://www.rangach.co.ke").includes(VIDEO_TIP_PRO_NOTE), false);
});

test("no tip when shop video is off on this deploy", () => {
  assert.equal(videoTipKind({ ...base, videoMode: "off" }), null);
  assert.deepEqual(videoTipLines(null, "https://www.rangach.co.ke"), []);
});

test("the link opens the seller's own shop video section through sign-in", () => {
  const url = new URL(shopVideoEditorUrl("https://www.rangach.co.ke/"));
  assert.equal(url.origin, "https://www.rangach.co.ke");
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("next"), SHOP_VIDEO_EDITOR_PATH);
  assert.equal(safePath(url.searchParams.get("next") ?? "", "/"), "/account/storefront#shop-video");
});

test("the weekly AI email carries the fixed tip only when asked", () => {
  const result = { summary: "A quiet week.", tips: [{ title: "Add a photo", body: "Two listings have no photo.", action: "add_photo" as const }] };
  const withTip = tipEmailText("Amina", result, "https://u", { kind: "upload", origin: "https://www.rangach.co.ke" });
  assert.ok(withTip.includes(VIDEO_TIP_TITLE));
  assert.ok(withTip.indexOf(VIDEO_TIP_TITLE) < withTip.indexOf("Unsubscribe:"));
  assert.ok(withTip.includes("Add your shop video: https://www.rangach.co.ke/login?next=%2Faccount%2Fstorefront%23shop-video"));
  assert.equal(tipEmailText("Amina", result, "https://u").includes(VIDEO_TIP_TITLE), false);
  assert.equal(
    tipEmailText("Amina", result, "https://u", { kind: null, origin: "https://www.rangach.co.ke" }).includes(VIDEO_TIP_TITLE),
    false,
  );
});

function gaps() {
  return computeShopGaps({
    bannerUrl: "",
    bio: "",
    phone: "",
    whatsapp: "",
    offerings: [],
    listings: [],
    branches: [],
    hasSocialHandle: false,
  });
}

function visSeller(overrides: Partial<VisibilitySeller> = {}): VisibilitySeller {
  return {
    userId: "user_1",
    storefrontId: "shop_1",
    email: "amina@example.com",
    name: "Amina",
    slug: "amina",
    optOut: false,
    lastSentAt: null,
    gaps: gaps(),
    videoTip: null,
    ...overrides,
  };
}

test("the weekly visibility email adds the tip only to targeted shops", async () => {
  const sent: string[] = [];
  const result = await runVisibilityTips({
    now: new Date("2026-11-30T06:00:00Z"),
    origin: "https://www.rangach.co.ke",
    env: {
      NODE_ENV: "test",
      SELLER_VISIBILITY_EMAIL: "1",
      ZEPTOMAIL_TOKEN: "zoho-token",
      EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
      CRON_SECRET: "long-secret",
    } as unknown as NodeJS.ProcessEnv,
    sellers: [visSeller({ videoTip: "upload" }), visSeller({ userId: "user_2", storefrontId: "shop_2", videoTip: null })],
    send: async (message) => {
      sent.push(message.text);
      return "sent";
    },
    markSent: async () => {},
  });
  assert.equal(result.emailed, 2);
  assert.equal(sent[0]?.includes(VIDEO_TIP_TITLE), true);
  assert.equal(sent[1]?.includes(VIDEO_TIP_TITLE), false);
  const text = visibilityEmailText({ name: "Amina", shopUrl: "https://x/b/a", tips: [], unsubscribe: "https://u" });
  assert.equal(text.includes(VIDEO_TIP_TITLE), false);
});
