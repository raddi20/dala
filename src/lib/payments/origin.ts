import "server-only";
import { headers } from "next/headers";
import { explicitSiteUrl } from "@/lib/brand";

/**
 * Origin for metadata, share links, WhatsApp drafts, and the Flutterwave return URL.
 * A configured APP_URL / AUTH_URL / NEXTAUTH_URL wins. Otherwise the request host is used,
 * so local dev and the current Vercel host keep working until APP_URL is set.
 */
export async function publicOrigin() {
  const configured = explicitSiteUrl();
  if (configured) return configured;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "http://localhost:3000";
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
