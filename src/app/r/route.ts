import type { NextRequest } from "next/server";
import { recruiterBareRedirect } from "@/lib/recruiter-redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public. /r with no code still opens the shop form. */
export function GET(request: NextRequest) {
  return recruiterBareRedirect(request);
}

export function HEAD(request: NextRequest) {
  return GET(request);
}
