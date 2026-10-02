import { explicitSiteUrl } from "@/lib/brand";

export type VideoMode = "off" | "mock" | "live";

export type VideoEnv = {
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
  MUX_WEBHOOK_SECRET?: string;
  MUX_SIGNING_KEY_ID?: string;
  MUX_SIGNING_PRIVATE_KEY?: string;
  MUX_AI_MODERATION?: string;
  MUX_MOCK?: string;
  APP_URL?: string;
  AUTH_URL?: string;
  NEXTAUTH_URL?: string;
  [key: string]: string | undefined;
};

const PRODUCTION_HOSTS = ["rangach.co.ke", "www.rangach.co.ke"];

export function flagOn(value: string | undefined | null) {
  const flag = value?.trim().toLowerCase() ?? "";
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * Missing Mux keys must not break the site. Mock mode never calls Mux.
 * Mock wins over real keys so a laptop can exercise the flow without a network call.
 */
export function videoMode(env: VideoEnv = process.env): VideoMode {
  if (flagOn(env.MUX_MOCK)) return "mock";
  if (env.MUX_TOKEN_ID?.trim() && env.MUX_TOKEN_SECRET?.trim()) return "live";
  return "off";
}

export function aiModerationEnabled(env: VideoEnv = process.env) {
  return flagOn(env.MUX_AI_MODERATION);
}

export function signingConfigured(env: VideoEnv = process.env) {
  return Boolean(env.MUX_SIGNING_KEY_ID?.trim() && env.MUX_SIGNING_PRIVATE_KEY?.trim());
}

function hostnameOf(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

/**
 * Referrer hostnames allowed to play an approved video.
 * Always includes the configured site, the www and apex pair, and localhost.
 * Mux allows at most 10 domains on one restriction.
 */
export function playbackReferrerDomains(env: VideoEnv = process.env): string[] {
  const hosts = new Set<string>(["localhost", ...PRODUCTION_HOSTS]);
  const configured = hostnameOf(env.APP_URL) || hostnameOf(env.AUTH_URL) || hostnameOf(env.NEXTAUTH_URL) || hostnameOf(explicitSiteUrl());
  if (configured && configured !== "localhost" && configured !== "127.0.0.1") {
    hosts.add(configured);
    if (configured.startsWith("www.")) hosts.add(configured.slice(4));
    else if (!configured.includes("localhost")) hosts.add(`www.${configured}`);
  }
  return [...hosts].slice(0, 10);
}

export function isAllowedUploadOrigin(origin: string, env: VideoEnv = process.env) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return url.protocol === "http:" || url.protocol === "https:";
  if (url.protocol !== "https:") return false;
  return playbackReferrerDomains(env).includes(host);
}

export function configuredSiteOrigin(env: VideoEnv = process.env) {
  return (env.APP_URL || env.AUTH_URL || env.NEXTAUTH_URL || explicitSiteUrl() || "https://www.rangach.co.ke").replace(/\/$/, "");
}
