import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, sentryDsn, sentryInitOptions } from "@/lib/sentry";

if (sentryDsn()) {
  Sentry.init({
    ...sentryInitOptions(),
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

export const onRouterTransitionStart = sentryDsn() ? Sentry.captureRouterTransitionStart : undefined;
