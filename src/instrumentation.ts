import * as Sentry from "@sentry/nextjs";
import { sentryDsn } from "@/lib/sentry";

export async function register() {
  if (!sentryDsn()) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = ((...args: Parameters<typeof Sentry.captureRequestError>) => {
  if (!sentryDsn()) return;
  return Sentry.captureRequestError(...args);
}) satisfies typeof Sentry.captureRequestError;
