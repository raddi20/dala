import { NextResponse } from "next/server";
import { clientAddress } from "@/lib/client-address";
import { parseClientErrorReport, CLIENT_ERROR_BODY_LIMIT } from "@/lib/client-error-report";
import { takeClientErrorSlot } from "@/lib/rate-limit";
import { sentryDsn } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > CLIENT_ERROR_BODY_LIMIT) {
    return new NextResponse(null, { status: 413 });
  }

  const gate = await takeClientErrorSlot(await clientAddress());
  if (gate.limited) return new NextResponse(null, { status: 429 });

  const raw = await request.text();
  if (raw.length > CLIENT_ERROR_BODY_LIMIT) return new NextResponse(null, { status: 413 });
  if (!sentryDsn()) return new NextResponse(null, { status: 204 });

  const parsed = parseClientErrorReport(raw);
  if (!parsed.ok) return new NextResponse(null, { status: parsed.status });

  const { captureClientReport } = await import("@/sentry.server.config");
  captureClientReport(parsed.report);
  return new NextResponse(null, { status: 204 });
}
