import * as Sentry from "@sentry/nextjs";
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

initServerSentry();
