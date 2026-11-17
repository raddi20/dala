import { NextResponse, type NextRequest } from "next/server";
import {
  LIST_YOUR_SHOP_PATH,
  RECRUITER_COOKIE,
  recruiterCodeToStore,
  recruiterCookieOptions,
  recruiterShortHop,
} from "@/lib/recruiter";

/** Temporary. Chat apps and browsers must not keep this hop as a permanent URL. */
export const RECRUITER_REDIRECT_STATUS = 307;

function temporaryRedirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), RECRUITER_REDIRECT_STATUS);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/**
 * Public hop for /r/<code>. No session. Never a 404.
 * A valid code sets the same cookie /list-your-shop?ref= uses, then redirects there.
 * An invalid code opens the form with no ref and does not clear a cookie already stored.
 */
export function recruiterShortRedirect(request: NextRequest, rawCode: string) {
  const hop = recruiterShortHop(rawCode);
  const response = temporaryRedirect(request, hop.path);
  if (!hop.code) return response;
  const secure = request.nextUrl.protocol === "https:";
  const next = recruiterCodeToStore(request.cookies.get(RECRUITER_COOKIE)?.value, hop.code);
  if (next) response.cookies.set(RECRUITER_COOKIE, next, recruiterCookieOptions(secure));
  return response;
}

/** /r with no code still opens the shop form. */
export function recruiterBareRedirect(request: NextRequest) {
  return temporaryRedirect(request, LIST_YOUR_SHOP_PATH);
}
