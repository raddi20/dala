import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/ai/cron-auth";
import { runThankYouBackfill, thankYouBackfillOnceFlag } from "@/lib/seller-mail/thank-you-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot thank-you backfill for shops that were already live when the feature shipped.
 * Not registered in vercel.json. Run once after deploy, then leave unused.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.rangach.co.ke/api/seller/cron/thank-you-backfill?once=1"
 *
 * Requires CRON_SECRET and once=1 (query or JSON body). A second call is a no-op
 * because thankYouEmailSentAt is set after each successful send.
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
        hint: "This is a one-shot. Call with ?once=1 (or JSON {\"once\":1}) after deploy, then leave unused.",
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
