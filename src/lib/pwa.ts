import { DEFAULT_APP_NAME } from "@/lib/brand";

/**
 * Brand colours copied from the @theme block in src/app/globals.css.
 * theme_color is navy (the gate mark and wordmark). background_color is paper.
 */
export const PWA_THEME_COLOR = "#1a2436";
export const PWA_BACKGROUND_COLOR = "#fffcf6";

/** Home-screen labels stay short. Twelve characters is the practical limit. */
export const PWA_NAME_MAX = 12;

const CLEAN_APP_NAME = /^[\p{L}\p{N}][\p{L}\p{N} '&._-]{0,11}$/u;

export type PwaNames = { name: string; shortName: string };

/**
 * Installed-app name. APP_NAME is used only when it is a short brand label
 * (letters, numbers, spaces, and simple punctuation, at most 12 characters).
 * Anything else stays Rangach so a bad override cannot become the home-screen name.
 */
export function pwaNames(rawName: string): PwaNames {
  const trimmed = rawName.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > PWA_NAME_MAX || !CLEAN_APP_NAME.test(trimmed)) {
    return { name: DEFAULT_APP_NAME, shortName: DEFAULT_APP_NAME };
  }
  return { name: trimmed, shortName: trimmed };
}

/** Kept for older clients that still write the key; the banner no longer gates on visits. */
export const INSTALL_VISITS_KEY = "rangach.pwa.visits";
export const INSTALL_SESSION_KEY = "rangach.pwa.visitCounted";
export const INSTALL_DISMISS_KEY = "rangach.pwa.dismissedAt";
export const INSTALL_INSTALLED_KEY = "rangach.pwa.installed";

/** Custom event the footer link dispatches to reopen the install guide after a dismiss. */
export const INSTALL_OPEN_EVENT = "rangach:open-install";

/** How long a dismissed install hint stays hidden (footer link still reopens it). */
export const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * android — Chrome/Edge with a deferred beforeinstallprompt (one-tap Install).
 * android-manual — Android without that event (Samsung Internet, engagement heuristics).
 * ios — iOS Safari, or another iOS browser on 16.4+ that exposes Share → Add to Home Screen.
 * ios-open-safari — older iOS Chrome/Firefox/Edge that cannot add to the home screen.
 * inapp — Facebook, Instagram, WhatsApp, and similar WebViews.
 */
export type InstallSurface = "android" | "android-manual" | "ios" | "ios-open-safari" | "inapp";

export type IosShareTarget = "safari" | "address-bar";

export type InstallGuide = {
  surface: InstallSurface;
  /** Where to find Share on iOS. Only set when surface is "ios". */
  iosShareTarget?: IosShareTarget;
};

export function normalizeAppPath(pathname: string): string {
  let path = pathname || "/";
  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(0, hash);
  const query = path.indexOf("?");
  if (query >= 0) path = path.slice(0, query);
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    } catch {
      break;
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.toLowerCase();
}

/** Install hints stay off the admin area and the sign-in / register screens. */
export function isInstallHiddenPath(pathname: string): boolean {
  const path = normalizeAppPath(pathname);
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/register" ||
    path.startsWith("/register/")
  );
}

/**
 * Banner eligibility. Shows on the first visit — no visit counter.
 * A dismiss hides the auto-banner for INSTALL_DISMISS_MS; the footer link
 * can still force the guide open. Standalone / already-installed stay hidden.
 */
export function shouldOfferInstall(input: {
  dismissedAt: number | null;
  now: number;
  installed: boolean;
  standalone: boolean;
  hiddenPath: boolean;
  /** Footer / menu "Install" ignores a prior dismiss. */
  force?: boolean;
}): boolean {
  if (input.hiddenPath || input.installed || input.standalone) return false;
  if (input.force) return true;
  if (input.dismissedAt != null && Number.isFinite(input.dismissedAt)) {
    if (input.now - input.dismissedAt < INSTALL_DISMISS_MS) return false;
  }
  return true;
}

/**
 * Facebook, Instagram, WhatsApp, TikTok, and similar in-app browsers.
 * They do not expose Add to Home Screen or beforeinstallprompt, so the install
 * hint must tell people to open the site in Chrome or Safari instead.
 */
export function isInAppBrowser(userAgent: string): boolean {
  const ua = userAgent || "";
  if (
    /FBAN|FBAV|FB_IAB|FBAN\/|FBIOS|Instagram|Line\/|MicroMessenger|WhatsApp|Snapchat|Pinterest|LinkedInApp|TikTok|Bytedance|musical_ly|Twitter|X\/|GSA\//i.test(
      ua,
    )
  ) {
    return true;
  }
  // Android WebView used by many host apps.
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return true;
  return false;
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent || "");
}

/** iPhone, iPod, or iPad (including iPadOS desktop-class UA). */
export function isIosDevice(input: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  const ua = input.userAgent;
  if (/iPhone|iPod|iPad/.test(ua)) return true;
  return /Macintosh/.test(ua) && input.platform === "MacIntel" && input.maxTouchPoints > 1;
}

/**
 * Parse iOS major.minor from a UA. Returns null when the string is not an iOS device.
 * Examples: "CPU iPhone OS 17_5", "CPU OS 16_3 like Mac OS X".
 */
export function parseIosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = /OS (\d+)[._](\d+)/.exec(userAgent || "");
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return { major, minor };
}

/** iOS 16.4+ lets Chrome, Firefox, and Edge add a site to the Home Screen. */
export function iosSupportsBrowserHomeScreen(version: { major: number; minor: number } | null): boolean {
  if (!version) return false;
  if (version.major > 16) return true;
  return version.major === 16 && version.minor >= 4;
}

/**
 * iPhone and iPad Safari only. Other iOS browsers and in-app WebViews are handled
 * separately so Chrome on iOS 16.4+ can still get the Share steps.
 */
export function isIosSafari(input: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  const ua = input.userAgent;
  if (isInAppBrowser(ua)) return false;
  if (!isIosDevice(input)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Android|DuckDuckGo|OPT\//.test(ua)) return false;
  if (!/Safari/i.test(ua)) return false;
  if (/Chrome|Chromium/.test(ua)) return false;
  return true;
}

/** Chrome, Firefox, Edge, Opera, or DuckDuckGo on an iPhone / iPad. */
export function isIosOtherBrowser(input: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  const ua = input.userAgent;
  if (isInAppBrowser(ua)) return false;
  if (!isIosDevice(input)) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|OPT\//.test(ua);
}

/**
 * Pick which install surface to show.
 * In-app browsers win first. Android without beforeinstallprompt still gets
 * manual menu steps. iOS Chrome/Firefox/Edge on 16.4+ get Share steps; older
 * versions are told to open Safari.
 */
export function resolveInstallSurface(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  hasDeferredPrompt: boolean;
}): InstallGuide | null {
  const ua = input.userAgent;
  if (isInAppBrowser(ua)) return { surface: "inapp" };

  if (isIosSafari(input)) {
    return { surface: "ios", iosShareTarget: "safari" };
  }

  if (isIosOtherBrowser(input)) {
    const version = parseIosVersion(ua);
    if (iosSupportsBrowserHomeScreen(version)) {
      return { surface: "ios", iosShareTarget: "address-bar" };
    }
    return { surface: "ios-open-safari" };
  }

  if (isAndroid(ua)) {
    if (input.hasDeferredPrompt) return { surface: "android" };
    return { surface: "android-manual" };
  }

  // Desktop Chromium with BIP can still one-tap install.
  if (input.hasDeferredPrompt) return { surface: "android" };
  return null;
}

export function installHintText(appName: string, mode: InstallSurface): string {
  if (mode === "ios" || mode === "ios-open-safari") {
    return `Add ${appName} to your Home Screen`;
  }
  if (mode === "inapp") {
    return `Open ${appName} in your browser to install it`;
  }
  if (mode === "android-manual") {
    return `Add ${appName} to your Home Screen`;
  }
  return `Install ${appName}`;
}
