import * as Sentry from "@sentry/nextjs";
import { sentryDsn } from "@/lib/sentry";

/** Sends the error only when a Sentry DSN is configured. */
export function reportError(error: unknown) {
  if (!sentryDsn()) return;
  Sentry.captureException(error);
}
