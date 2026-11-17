import { NextResponse, type NextRequest } from "next/server";
import { AGENT_COOKIE, agentCodeToStore, agentCookieOptions } from "@/lib/agent-code";
import {
  LIST_YOUR_SHOP_PATH,
  RECRUITER_COOKIE,
  recruiterCodeFromShortPath,
  recruiterCodeToStore,
  recruiterCookieOptions,
} from "@/lib/recruiter";
import { PRIVATE_HEADER } from "@/lib/sw-policy";

/** Auth.js session cookie, plain or __Secure-, possibly chunked (.0, .1). */
export function hasSessionCookie(names: readonly string[]): boolean {
  return names.some((name) => /^(__Secure-)?(authjs|next-auth)\.session-token(\.\d+)?$/.test(name));
}

/**
 * Stores a valid ?agent= code on any matched page.
 * First-touch unless a new valid code arrives. Junk does not clear a code already stored.
 *
 * /r/<code> is public. This does not sign anyone in. A valid code on that path
 * is stored in the same recruiter cookie as /list-your-shop?ref=. The route
 * handler sends the temporary redirect. An invalid code is left alone.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  // Signed-in pages are never kept by the service worker's offline page cache.
  if (hasSessionCookie(request.cookies.getAll().map((cookie) => cookie.name))) {
    response.headers.set(PRIVATE_HEADER, "1");
  }
  const secure = request.nextUrl.protocol === "https:";
  const code = agentCodeToStore(request.cookies.get(AGENT_COOKIE)?.value, request.nextUrl.searchParams.get("agent"));
  if (code) response.cookies.set(AGENT_COOKIE, code, agentCookieOptions(secure));
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (path === LIST_YOUR_SHOP_PATH) {
    const recruiter = recruiterCodeToStore(
      request.cookies.get(RECRUITER_COOKIE)?.value,
      request.nextUrl.searchParams.get("ref"),
    );
    if (recruiter) response.cookies.set(RECRUITER_COOKIE, recruiter, recruiterCookieOptions(secure));
  }
  const fromShort = recruiterCodeFromShortPath(path);
  if (fromShort) {
    const recruiter = recruiterCodeToStore(request.cookies.get(RECRUITER_COOKIE)?.value, fromShort);
    if (recruiter) response.cookies.set(RECRUITER_COOKIE, recruiter, recruiterCookieOptions(secure));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
