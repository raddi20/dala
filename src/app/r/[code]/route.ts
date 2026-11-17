import type { NextRequest } from "next/server";
import { recruiterShortRedirect } from "@/lib/recruiter-redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ code: string }> };

/** Public. Anyone with the link can open it. The code is not a secret. */
export async function GET(request: NextRequest, context: Context) {
  const { code } = await context.params;
  return recruiterShortRedirect(request, code);
}

export async function HEAD(request: NextRequest, context: Context) {
  return GET(request, context);
}
