import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import nextConfig from "../../next.config";
import manifest from "@/app/manifest";
import { APP_TAGLINE } from "@/lib/brand";
import {
  INSTALL_DISMISS_MS,
  PWA_BACKGROUND_COLOR,
  PWA_THEME_COLOR,
  installHintText,
  isInAppBrowser,
  isInstallHiddenPath,
  isIosSafari,
  nextVisitCount,
  pwaNames,
  resolveInstallSurface,
  shouldOfferInstall,
} from "@/lib/pwa";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const FB_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0;FBDV/iPhone]";
const IG_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 320.0.0.0.0";
const WA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.10";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36";

test("pwa colours match the Tailwind theme", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, new RegExp(`--color-navy:\\s*${PWA_THEME_COLOR}`));
  assert.match(css, new RegExp(`--color-paper:\\s*${PWA_BACKGROUND_COLOR}`));
});

test("installed name stays Rangach unless APP_NAME is a short clean label", () => {
  assert.deepEqual(pwaNames("Rangach"), { name: "Rangach", shortName: "Rangach" });
  assert.deepEqual(pwaNames("  Dala "), { name: "Dala", shortName: "Dala" });
  assert.deepEqual(pwaNames("Luo Home"), { name: "Luo Home", shortName: "Luo Home" });
  assert.deepEqual(pwaNames(""), { name: "Rangach", shortName: "Rangach" });
  assert.deepEqual(pwaNames("<script>"), { name: "Rangach", shortName: "Rangach" });
  assert.deepEqual(pwaNames("https://rangach.co.ke"), { name: "Rangach", shortName: "Rangach" });
  assert.deepEqual(pwaNames("A very long application name"), { name: "Rangach", shortName: "Rangach" });
});

test("manifest is installable and uses the gate-mark icons", () => {
  const data = manifest();
  assert.equal(data.name, "Rangach");
  assert.equal(data.short_name, "Rangach");
  assert.equal(data.start_url, "/");
  assert.equal(data.scope, "/");
  assert.equal(data.display, "standalone");
  assert.equal(data.theme_color, PWA_THEME_COLOR);
  assert.equal(data.background_color, PWA_BACKGROUND_COLOR);
  assert.match(data.description ?? "", new RegExp(APP_TAGLINE.replace(".", "\\.")));
  const icons = data.icons ?? [];
  assert.ok(icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any" && icon.type === "image/png"));
  assert.ok(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  assert.ok(icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "maskable"));
});

test("committed icons are pngs at the manifest sizes", () => {
  const files: Array<[string, number]> = [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["icon-maskable-192.png", 192],
    ["icon-maskable-512.png", 512],
  ];
  for (const [name, size] of files) {
    const bytes = readFileSync(new URL(`../../public/icons/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", name);
    assert.equal(bytes.readUInt32BE(16), size, name);
    assert.equal(bytes.readUInt32BE(20), size, name);
  }
});

test("install hint waits for a second visit, remembers dismissal, and hides on admin and auth", () => {
  const now = 1_800_000_000_000;
  const base = {
    visits: 2,
    dismissedAt: null,
    now,
    installed: false,
    standalone: false,
    hiddenPath: false,
  };
  assert.equal(shouldOfferInstall({ ...base, visits: 1 }), false);
  assert.equal(shouldOfferInstall(base), true);
  assert.equal(shouldOfferInstall({ ...base, hiddenPath: true }), false);
  assert.equal(shouldOfferInstall({ ...base, installed: true }), false);
  assert.equal(shouldOfferInstall({ ...base, standalone: true }), false);
  assert.equal(shouldOfferInstall({ ...base, dismissedAt: now - 1_000 }), false);
  assert.equal(shouldOfferInstall({ ...base, dismissedAt: now - INSTALL_DISMISS_MS }), true);
  assert.equal(INSTALL_DISMISS_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(nextVisitCount(0, false), 1);
  assert.equal(nextVisitCount(1, true), 1);
  assert.equal(nextVisitCount(1, false), 2);

  assert.equal(isInstallHiddenPath("/admin"), true);
  assert.equal(isInstallHiddenPath("/admin/reports"), true);
  assert.equal(isInstallHiddenPath("/login"), true);
  assert.equal(isInstallHiddenPath("/login?next=/listings"), true);
  assert.equal(isInstallHiddenPath("/register"), true);
  assert.equal(isInstallHiddenPath("/listings"), false);
  assert.equal(isInstallHiddenPath("/pricing"), false);
  assert.equal(isInstallHiddenPath("/account"), false);
});

test("iOS hint is Safari-only and uses the home-screen instructions", () => {
  assert.equal(isIosSafari({ userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(isIosSafari({ userAgent: CHROME_IOS, platform: "iPhone", maxTouchPoints: 5 }), false);
  assert.equal(isIosSafari({ userAgent: ANDROID_CHROME, platform: "Linux armv8l", maxTouchPoints: 5 }), false);
  assert.equal(isIosSafari({ userAgent: FB_IOS, platform: "iPhone", maxTouchPoints: 5 }), false);
  assert.equal(
    isIosSafari({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    }),
    false,
  );
  assert.equal(
    isIosSafari({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(installHintText("Rangach", "ios"), "Add Rangach to your Home Screen");
  assert.equal(installHintText("Rangach", "android"), "Install Rangach");
  assert.equal(installHintText("Rangach", "inapp"), "Open Rangach in your browser to install it");
});

test("in-app browsers are detected across Facebook Instagram WhatsApp and WebView", () => {
  assert.equal(isInAppBrowser(FB_IOS), true);
  assert.equal(isInAppBrowser(IG_ANDROID), true);
  assert.equal(isInAppBrowser(WA_ANDROID), true);
  assert.equal(isInAppBrowser(ANDROID_WEBVIEW), true);
  assert.equal(isInAppBrowser(IPHONE_SAFARI), false);
  assert.equal(isInAppBrowser(ANDROID_CHROME), false);
  assert.equal(isInAppBrowser(CHROME_IOS), false);
});

test("resolveInstallSurface picks in-app, iOS Safari, or Android BIP", () => {
  assert.equal(
    resolveInstallSurface({
      userAgent: FB_IOS,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: true,
    }),
    "inapp",
  );
  assert.equal(
    resolveInstallSurface({
      userAgent: IPHONE_SAFARI,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    "ios",
  );
  assert.equal(
    resolveInstallSurface({
      userAgent: ANDROID_CHROME,
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      hasDeferredPrompt: true,
    }),
    "android",
  );
  assert.equal(
    resolveInstallSurface({
      userAgent: ANDROID_CHROME,
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    null,
  );
  assert.equal(
    resolveInstallSurface({
      userAgent: CHROME_IOS,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    null,
  );
});

test("sw.js is not cached for long and is allowed at the origin scope", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  const sw = rules.find((rule) => rule.source === "/sw.js");
  assert.ok(sw);
  const cache = sw.headers.find((header) => header.key === "Cache-Control");
  const scope = sw.headers.find((header) => header.key === "Service-Worker-Allowed");
  assert.equal(cache?.value, "no-cache, no-store, must-revalidate");
  assert.equal(scope?.value, "/");
});
