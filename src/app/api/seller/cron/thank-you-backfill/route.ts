import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { runThankYouBackfill, thankYouBackfillOnceFlag } from "@/lib/seller-mail/thank-you-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot thank-you backfill for shops that were already live when the feature shipped.
 * Temporary hourly Vercel cron (vercel.json) so CRON_SECRET is attached automatically.
 * Idempotent: after the first successful hour, later runs send zero (thankYouEmailSentAt).
 * Remove the cron entry from vercel.json once the backfill has completed.
 *
 * Manual:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.rangach.co.ke/api/seller/cron/thank-you-backfill?once=1"
 *
 * Requires CRON_SECRET. once=1 via query/body for manual calls, or x-vercel-cron: 1 from Vercel.
 */
export async function handleThankYouBackfill(
  request: Request,
  deps: {
    env?: NodeJS.ProcessEnv;
    run?: typeof runThankYouBackfill;
    readBody?: () => Promise<unknown>;
  } = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!cronAuthorized(request, env)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  if (deps.readBody) {
    body = await deps.readBody();
  } else if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  if (!thankYouBackfillOnceFlag(request, body)) {
    return NextResponse.json(
      {
        error: "Refusing to run without once=1",
        hint: "This is a one-shot. Call with ?once=1 (or JSON {\"once\":1}), or wait for the hourly Vercel cron.",
      },
      { status: 400 },
    );
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
