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

export const INSTALL_VISITS_KEY = "rangach.pwa.visits";
export const INSTALL_SESSION_KEY = "rangach.pwa.visitCounted";
export const INSTALL_DISMISS_KEY = "rangach.pwa.dismissedAt";
export const INSTALL_INSTALLED_KEY = "rangach.pwa.installed";

/** How long a dismissed install hint stays hidden. */
export const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export type InstallSurface = "android" | "ios" | "inapp";

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

export function shouldOfferInstall(input: {
  visits: number;
  dismissedAt: number | null;
  now: number;
  installed: boolean;
  standalone: boolean;
  hiddenPath: boolean;
}): boolean {
  if (input.hiddenPath || input.installed || input.standalone) return false;
  if (!Number.isFinite(input.visits) || input.visits < 2) return false;
  if (input.dismissedAt != null && Number.isFinite(input.dismissedAt)) {
    if (input.now - input.dismissedAt < INSTALL_DISMISS_MS) return false;
  }
  return true;
}

export function nextVisitCount(current: number, alreadyCountedThisSession: boolean): number {
  const safe = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  if (alreadyCountedThisSession) return safe;
  return safe + 1;
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

/**
 * iPhone and iPad Safari only. Other iOS browsers and in-app WebViews do not
 * offer Add to Home Screen from the same Share sheet.
 */
export function isIosSafari(input: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  const ua = input.userAgent;
  if (isInAppBrowser(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Android|DuckDuckGo|OPT\//.test(ua)) return false;
  const iPhone = /iPhone|iPod/.test(ua);
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && input.platform === "MacIntel" && input.maxTouchPoints > 1);
  if (!iPhone && !iPad) return false;
  if (!/Safari/i.test(ua)) return false;
  if (/Chrome|Chromium/.test(ua)) return false;
  return true;
}

/**
 * Pick which install surface to show. In-app browsers win over iOS Safari
 * detection because their UAs often still contain "Safari". Android only
 * returns when a deferred beforeinstallprompt event is available.
 */
export function resolveInstallSurface(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  hasDeferredPrompt: boolean;
}): InstallSurface | null {
  if (isInAppBrowser(input.userAgent)) return "inapp";
  if (
    isIosSafari({
      userAgent: input.userAgent,
      platform: input.platform,
      maxTouchPoints: input.maxTouchPoints,
    })
  ) {
    return "ios";
  }
  if (input.hasDeferredPrompt) return "android";
  return null;
}

export function installHintText(appName: string, mode: InstallSurface): string {
  if (mode === "ios") {
    return `Add ${appName} to your Home Screen`;
  }
  if (mode === "inapp") {
    return `Open ${appName} in your browser to install it`;
  }
  return `Install ${appName}`;
}
