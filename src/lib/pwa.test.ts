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
  iosSupportsBrowserHomeScreen,
  isAndroid,
  isInAppBrowser,
  isInstallHiddenPath,
  isIosOtherBrowser,
  isIosSafari,
  parseIosVersion,
  pwaNames,
  resolveInstallSurface,
  shouldOfferInstall,
} from "@/lib/pwa";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1";
const CHROME_IOS_OLD =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.114 Mobile/15E148 Safari/604.1";
const FIREFOX_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const SAMSUNG_INTERNET =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
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

test("install hint shows on the first visit, remembers dismissal, and hides on admin and auth", () => {
  const now = 1_800_000_000_000;
  const base = {
    dismissedAt: null,
    now,
    installed: false,
    standalone: false,
    hiddenPath: false,
  };
  assert.equal(shouldOfferInstall(base), true);
  assert.equal(shouldOfferInstall({ ...base, hiddenPath: true }), false);
  assert.equal(shouldOfferInstall({ ...base, installed: true }), false);
  assert.equal(shouldOfferInstall({ ...base, standalone: true }), false);
  assert.equal(shouldOfferInstall({ ...base, dismissedAt: now - 1_000 }), false);
  assert.equal(shouldOfferInstall({ ...base, dismissedAt: now - 1_000, force: true }), true);
  assert.equal(shouldOfferInstall({ ...base, dismissedAt: now - INSTALL_DISMISS_MS }), true);
  assert.equal(INSTALL_DISMISS_MS, 30 * 24 * 60 * 60 * 1000);

  assert.equal(isInstallHiddenPath("/admin"), true);
  assert.equal(isInstallHiddenPath("/admin/reports"), true);
  assert.equal(isInstallHiddenPath("/login"), true);
  assert.equal(isInstallHiddenPath("/login?next=/listings"), true);
  assert.equal(isInstallHiddenPath("/register"), true);
  assert.equal(isInstallHiddenPath("/listings"), false);
  assert.equal(isInstallHiddenPath("/pricing"), false);
  assert.equal(isInstallHiddenPath("/account"), false);
});

test("iOS version parsing and 16.4 home-screen support", () => {
  assert.deepEqual(parseIosVersion(IPHONE_SAFARI), { major: 17, minor: 5 });
  assert.deepEqual(parseIosVersion(CHROME_IOS_OLD), { major: 15, minor: 7 });
  assert.equal(parseIosVersion(ANDROID_CHROME), null);
  assert.equal(iosSupportsBrowserHomeScreen({ major: 16, minor: 4 }), true);
  assert.equal(iosSupportsBrowserHomeScreen({ major: 16, minor: 3 }), false);
  assert.equal(iosSupportsBrowserHomeScreen({ major: 17, minor: 0 }), true);
  assert.equal(iosSupportsBrowserHomeScreen(null), false);
});

test("iOS Safari and other browsers are detected separately", () => {
  assert.equal(isIosSafari({ userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(isIosSafari({ userAgent: CHROME_IOS, platform: "iPhone", maxTouchPoints: 5 }), false);
  assert.equal(isIosOtherBrowser({ userAgent: CHROME_IOS, platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(isIosOtherBrowser({ userAgent: FIREFOX_IOS, platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(isIosOtherBrowser({ userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5 }), false);
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
  assert.equal(installHintText("Rangach", "android-manual"), "Add Rangach to your Home Screen");
  assert.equal(installHintText("Rangach", "inapp"), "Open Rangach in your browser to install it");
  assert.equal(installHintText("Rangach", "ios-open-safari"), "Add Rangach to your Home Screen");
});

test("in-app browsers are detected across Facebook Instagram WhatsApp and WebView", () => {
  assert.equal(isInAppBrowser(FB_IOS), true);
  assert.equal(isInAppBrowser(IG_ANDROID), true);
  assert.equal(isInAppBrowser(WA_ANDROID), true);
  assert.equal(isInAppBrowser(ANDROID_WEBVIEW), true);
  assert.equal(isInAppBrowser(IPHONE_SAFARI), false);
  assert.equal(isInAppBrowser(ANDROID_CHROME), false);
  assert.equal(isInAppBrowser(CHROME_IOS), false);
  assert.equal(isAndroid(ANDROID_CHROME), true);
  assert.equal(isAndroid(SAMSUNG_INTERNET), true);
  assert.equal(isAndroid(IPHONE_SAFARI), false);
});

test("resolveInstallSurface covers Android manual, iOS Chrome, and in-app", () => {
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: FB_IOS,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: true,
    }),
    { surface: "inapp" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: IPHONE_SAFARI,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    { surface: "ios", iosShareTarget: "safari" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: CHROME_IOS,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    { surface: "ios", iosShareTarget: "address-bar" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: FIREFOX_IOS,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    { surface: "ios", iosShareTarget: "address-bar" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: CHROME_IOS_OLD,
      platform: "iPhone",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    { surface: "ios-open-safari" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: ANDROID_CHROME,
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      hasDeferredPrompt: true,
    }),
    { surface: "android" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: ANDROID_CHROME,
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    { surface: "android-manual" },
  );
  assert.deepEqual(
    resolveInstallSurface({
      userAgent: SAMSUNG_INTERNET,
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      hasDeferredPrompt: false,
    }),
    { surface: "android-manual" },
  );
  assert.equal(
    resolveInstallSurface({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      platform: "MacIntel",
      maxTouchPoints: 0,
      hasDeferredPrompt: false,
    }),
    null,
  );
});

test("footer and header keep an Install Rangach control", () => {
  const footer = readFileSync(new URL("../components/footer.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../components/header.tsx", import.meta.url), "utf8");
  assert.match(footer, /InstallAppLink/);
  assert.match(header, /InstallAppLink/);
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
