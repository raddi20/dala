import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, sentryDsn, sentryInitOptions } from "@/lib/sentry";

export function initEdgeSentry() {
  if (!sentryDsn() || Sentry.isInitialized()) return;
  Sentry.init({
    ...sentryInitOptions(),
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

export function captureEdgeRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  initEdgeSentry();
  Sentry.captureRequestError(error, request, context);
}

initEdgeSentry();
