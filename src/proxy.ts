import { NextResponse, type NextRequest } from "next/server";
import { AGENT_COOKIE, agentCodeToStore, agentCookieOptions } from "@/lib/agent-code";

/**
 * Stores a valid ?agent= code on any matched page.
 * First-touch unless a new valid code arrives. Junk does not clear a code already stored.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const code = agentCodeToStore(request.cookies.get(AGENT_COOKIE)?.value, request.nextUrl.searchParams.get("agent"));
  if (!code) return response;
  response.cookies.set(AGENT_COOKIE, code, agentCookieOptions(request.nextUrl.protocol === "https:"));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
