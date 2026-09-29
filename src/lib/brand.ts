/**
 * Display name and public origin.
 * The npm package, database, cookies, and payment reference prefix stay as they are.
 */

export const DEFAULT_APP_NAME = "Rangach";

/** Live site until a custom domain is set with APP_URL. */
export const DEFAULT_SITE_URL = "https://dala-sigma.vercel.app";

export const APP_MEANING = 'Dholuo for "gate, the entrance to a homestead"';

export const APP_TAGLINE = "The gateway to the Luo home.";

export const APP_DESCRIPTION =
  "Discover Luo-owned businesses, housing, and classifieds in Nairobi and London. Discovery here — chat stays on WhatsApp.";

/** Optional override. Defaults to Rangach. Read on the server and passed into client UI. */
export function appName() {
  const value = process.env.APP_NAME?.trim() ?? "";
  return value || DEFAULT_APP_NAME;
}

/**
 * Public origin from env, with no trailing slash.
 * Same order the payments code already used: APP_URL, then AUTH_URL, then NEXTAUTH_URL.
 */
export function explicitSiteUrl() {
  const raw = (process.env.APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").trim();
  return raw.replace(/\/$/, "");
}

/** Configured origin, or the current Vercel site when none of those vars are set. */
export function defaultSiteUrl() {
  return explicitSiteUrl() || DEFAULT_SITE_URL;
}
