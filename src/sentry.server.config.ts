import * as Sentry from "@sentry/nextjs";
import type { ClientErrorReport } from "@/lib/client-error-report";
import { scrubSentryEvent, sentryDsn, sentryInitOptions } from "@/lib/sentry";

/** Error capture only. Tracing and the OpenTelemetry provider stay off. */
export function initServerSentry() {
  if (!sentryDsn() || Sentry.isInitialized()) return;
  Sentry.init({
    ...sentryInitOptions(),
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

export function captureClientReport(report: ClientErrorReport) {
  initServerSentry();
  const error = new Error(report.message);
  if (report.stack) error.stack = report.stack;
  Sentry.captureException(error, {
    extra: { digest: report.digest, href: report.href },
  });
}

export function captureNodeRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  initServerSentry();
  Sentry.captureRequestError(error, request, context);
}

initServerSentry();
