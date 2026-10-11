import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import jsQR from "jsqr";
import sharp from "sharp";
import { buildShareMetadata, withoutRefQuery } from "@/lib/share-metadata";
import { viewKindForPath } from "@/lib/stats/events";
import {
  canViewSticker,
  parseStickerSize,
  recordStickerVisit,
  shouldRecordStickerScan,
  stickerFilename,
  stickerScanLabel,
  stickerTargetUrl,
  type StickerCounter,
} from "@/lib/sticker";
import { qrDrawing, STICKER_ECC, STICKER_QUIET } from "@/lib/sticker-qr";
import { stickerDocument, stickerPng } from "@/lib/sticker-svg";

const root = fileURLToPath(new URL("../..", import.meta.url));
const shopUrl = "https://www.rangach.co.ke/b/mama-atieno?ref=sticker";
const browser = "Mozilla/5.0 (Linux; Android 12; Phone) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile";

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function filesUnder(dir: string, found: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next") continue;
    const stat = statSync(path);
    if (stat.isDirectory()) filesUnder(path, found);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) found.push(path);
  }
  return found;
}

test("the sticker QR encodes the public shop URL with ref=sticker", () => {
  assert.equal(stickerTargetUrl("https://www.rangach.co.ke", "mama-atieno"), shopUrl);
  assert.equal(stickerTargetUrl("https://www.rangach.co.ke/", "mama-atieno"), shopUrl);
  assert.equal(STICKER_ECC, "Q");
  assert.equal(STICKER_QUIET, 4);
  assert.equal(parseStickerSize("square"), "square");
  assert.equal(parseStickerSize("poster"), "a6");
  assert.equal(stickerFilename("Mama Atieno!", "a6", "png"), "rangach-Mama-Atieno-a6.png");
});

test("a decoder reads the sticker QR, including the downloaded PNG", async () => {
  const drawing = qrDrawing(shopUrl);
  const scale = 6;
  const dim = drawing.size * scale;
  const pixels = new Uint8ClampedArray(dim * dim * 4);
  pixels.fill(255);
  const commands = drawing.path.match(/M(\d+) (\d+)h1v1h-1z/g) ?? [];
  assert.ok(commands.length > 20);
  for (const command of commands) {
    const match = /M(\d+) (\d+)/.exec(command);
    if (!match) continue;
    const mx = Number(match[1]) * scale;
    const my = Number(match[2]) * scale;
    for (let y = my; y < my + scale; y += 1) {
      for (let x = mx; x < mx + scale; x += 1) {
        const index = (y * dim + x) * 4;
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      }
    }
  }
  assert.equal(jsQR(pixels, dim, dim)?.data, shopUrl);

  const png = await stickerPng({ name: "Mama Atieno's Kitchen", url: shopUrl, size: "a6" }, 96);
  const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height);
  assert.equal(decoded?.data, shopUrl);

  const svg = stickerDocument({ name: "Mama Atieno's Kitchen", url: shopUrl, size: "square" });
  assert.match(svg, /Scan to see our products &amp; WhatsApp us/);
  assert.match(svg, /rangach\.co\.ke/);
  assert.match(svg, /Find us on Rangach/);
  assert.match(svg, /Mama Atieno/);
  assert.match(svg, /Kitchen/);
});

test("sticker access is public only for a published shop", () => {
  const open = {
    published: true,
    publiclyHidden: false,
    shopHidden: false,
    ownerSuspended: false,
    isOwner: false,
    isAdmin: false,
  };
  assert.equal(canViewSticker(open), true);
  assert.equal(canViewSticker({ ...open, published: false }), false);
  assert.equal(canViewSticker({ ...open, published: false, isOwner: true }), true);
  assert.equal(canViewSticker({ ...open, published: false, isAdmin: true }), true);
  assert.equal(canViewSticker({ ...open, publiclyHidden: true }), false);
  assert.equal(canViewSticker({ ...open, publiclyHidden: true, isOwner: true }), true);
  assert.equal(canViewSticker({ ...open, publiclyHidden: true, isAdmin: true }), true);
  assert.equal(canViewSticker({ ...open, shopHidden: true }), false);
  assert.equal(canViewSticker({ ...open, shopHidden: true, isOwner: true }), true);
  assert.equal(canViewSticker({ ...open, shopHidden: true, isAdmin: true }), true);
  assert.equal(canViewSticker({ ...open, ownerSuspended: true }), false);
  assert.equal(canViewSticker({ ...open, ownerSuspended: true, isOwner: true }), true);
  assert.equal(canViewSticker({ ...open, ownerSuspended: true, isAdmin: true }), true);

  const loader = read("src/lib/sticker-shop.ts");
  assert.match(loader, /shopHidden: shop\.hidden/);
  assert.match(loader, /ownerSuspended: shop\.user\.suspended/);
  assert.match(read("src/app/b/[slug]/sticker/page.tsx"), /loadStickerShop/);
  assert.match(read("src/app/b/[slug]/sticker/file/route.ts"), /loadStickerShop/);
  const shopPage = read("src/app/b/[slug]/page.tsx");
  assert.match(shopPage, /shopHidden: shop\.hidden/);
  assert.match(shopPage, /ownerSuspended: shop\.user\.suspended/);
});

test("ref=sticker counts one visit and stores no personal data", async () => {
  const seen: string[] = [];
  const counter: StickerCounter = {
    async increment(id) {
      seen.push(id);
    },
  };
  const base = {
    storefrontId: "shop_1",
    ref: "sticker",
    userAgent: browser,
    published: true,
    publiclyHidden: false,
    shopHidden: false,
    ownerSuspended: false,
  };
  assert.equal(await recordStickerVisit(counter, base), true);
  assert.equal(await recordStickerVisit(counter, { ...base, ref: "" }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, ref: "email" }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, published: false }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, publiclyHidden: true }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, shopHidden: true }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, ownerSuspended: true }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, userAgent: "Googlebot" }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, userAgent: "" }), false);
  assert.equal(await recordStickerVisit(counter, { ...base, prefetch: true }), false);
  assert.deepEqual(seen, ["shop_1"]);
  assert.equal(shouldRecordStickerScan(base), true);
  assert.equal(stickerScanLabel(1), "1 sticker scan");
  assert.equal(stickerScanLabel(4), "4 sticker scans");
});

test("canonical URLs drop ref and the print page is not a public link", () => {
  assert.equal(withoutRefQuery("/b/mama-atieno?ref=sticker"), "/b/mama-atieno");
  assert.equal(withoutRefQuery("/b/mama-atieno?ref=sticker&ok=1"), "/b/mama-atieno?ok=1");
  assert.equal(withoutRefQuery("/b/mama-atieno"), "/b/mama-atieno");
  const meta = buildShareMetadata({
    origin: "https://www.rangach.co.ke",
    path: "/b/mama-atieno?ref=sticker",
    title: "Mama",
    description: "Shop",
    image: "/b/mama-atieno/opengraph-image",
    imageAlt: "Mama",
  });
  assert.equal(meta.alternates?.canonical, "https://www.rangach.co.ke/b/mama-atieno");
  assert.equal(meta.openGraph?.url, "https://www.rangach.co.ke/b/mama-atieno");
  assert.equal(viewKindForPath("/b/mama-atieno/sticker"), null);

  const css = read("src/app/b/[slug]/sticker/sticker.css");
  assert.match(css, /@page\s*\{[^}]*size:\s*105mm 148mm/);
  assert.match(css, /@page sticker-square\s*\{[^}]*size:\s*100mm 100mm/);
  assert.match(css, /@media print/);
  assert.match(css, /header,\s*footer/);
  const page = read("src/app/b/[slug]/sticker/page.tsx");
  assert.match(page, /sticker\.css/);
  assert.equal(page.includes("<script"), false);
  assert.match(read("src/app/account/storefront/page.tsx"), /Print sticker/);
  assert.match(read("src/app/admin/page.tsx"), /Print sticker/);
  assert.equal(read("src/components/header.tsx").includes("/sticker"), false);
  assert.equal(read("src/components/footer.tsx").includes("/sticker"), false);
  assert.equal(/href=["'{].*\/sticker/.test(read("src/app/b/[slug]/page.tsx")), false);
  assert.match(read("src/components/header.tsx"), /print:hidden/);
  assert.match(read("src/components/footer.tsx"), /print:hidden/);

  const importers = filesUnder(join(root, "src")).filter(
    (file) => !file.endsWith(".test.ts") && readFileSync(file, "utf8").includes('from "uqr"'),
  );
  assert.equal(importers.length, 1);
  assert.equal(importers[0]?.endsWith(`${join("src", "lib", "sticker-qr.ts")}`), true);
});
