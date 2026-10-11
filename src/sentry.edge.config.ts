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

initEdgeSentry();
