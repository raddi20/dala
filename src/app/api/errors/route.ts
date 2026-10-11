import { NextResponse } from "next/server";
import { parseClientErrorReport, CLIENT_ERROR_BODY_LIMIT } from "@/lib/client-error-report";
import { sentryDsn } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > CLIENT_ERROR_BODY_LIMIT) {
    return new NextResponse(null, { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > CLIENT_ERROR_BODY_LIMIT) return new NextResponse(null, { status: 413 });
  if (!sentryDsn()) return new NextResponse(null, { status: 204 });

  const parsed = parseClientErrorReport(raw);
  if (!parsed.ok) return new NextResponse(null, { status: parsed.status });

  const { initServerSentry } = await import("@/sentry.server.config");
  initServerSentry();
  const Sentry = await import("@sentry/nextjs");
  const error = new Error(parsed.report.message);
  if (parsed.report.stack) error.stack = parsed.report.stack;
  Sentry.captureException(error, {
    extra: { digest: parsed.report.digest, href: parsed.report.href },
  });
  return new NextResponse(null, { status: 204 });
}
