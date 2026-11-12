import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { runThankYouBackfill } from "@/lib/seller-mail/thank-you-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot thank-you backfill for shops that were already live when the feature shipped.
 * Temporary hourly Vercel cron (vercel.json). Idempotent via thankYouEmailSentAt:
 * a shop that already has that timestamp is skipped, so later hours send nothing for it.
 * Remove the cron entry from vercel.json once the backfill has completed.
 *
 * Vercel Cron GETs this path with `Authorization: Bearer $CRON_SECRET` and
 * `User-Agent: vercel-cron/1.0`. It does not send `x-vercel-cron` or `?once=1`.
 * A valid bearer is the opt-in and is enough to run. A missing, wrong, or unset
 * CRON_SECRET is rejected. User-Agent, `x-vercel-cron`, and `x-vercel-cron-schedule`
 * are ignored for authorization.
 *
 * Manual:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.rangach.co.ke/api/seller/cron/thank-you-backfill"
 */
export async function handleThankYouBackfill(
  request: Request,
  deps: {
    env?: NodeJS.ProcessEnv;
    run?: typeof runThankYouBackfill;
  } = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!cronAuthorized(request, env)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await (deps.run ?? runThankYouBackfill)();
    return NextResponse.json({ ...result, tipEmails: 0, note: "one-shot thank-you only; no visibility tips" });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handleThankYouBackfill(request);
}

export function POST(request: Request) {
  return handleThankYouBackfill(request);
}
