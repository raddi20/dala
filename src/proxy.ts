import { NextResponse, type NextRequest } from "next/server";
import { AGENT_COOKIE, agentCodeToStore, agentCookieOptions } from "@/lib/agent-code";
import { PRIVATE_HEADER } from "@/lib/sw-policy";

/** Auth.js session cookie, plain or __Secure-, possibly chunked (.0, .1). */
export function hasSessionCookie(names: readonly string[]): boolean {
  return names.some((name) => /^(__Secure-)?(authjs|next-auth)\.session-token(\.\d+)?$/.test(name));
}

/**
 * Stores a valid ?agent= code on any matched page.
 * First-touch unless a new valid code arrives. Junk does not clear a code already stored.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  // Signed-in pages are never kept by the service worker's offline page cache.
  if (hasSessionCookie(request.cookies.getAll().map((cookie) => cookie.name))) {
    response.headers.set(PRIVATE_HEADER, "1");
  }
  const code = agentCodeToStore(request.cookies.get(AGENT_COOKIE)?.value, request.nextUrl.searchParams.get("agent"));
  if (!code) return response;
  response.cookies.set(AGENT_COOKIE, code, agentCookieOptions(request.nextUrl.protocol === "https:"));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
