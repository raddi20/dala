import "server-only";
import { headers } from "next/headers";

/** Origin used for the Flutterwave return URL. */
export async function publicOrigin() {
  const configured = (process.env.APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "http://localhost:3000";
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
