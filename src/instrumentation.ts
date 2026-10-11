import type { InstrumentationOnRequestError } from "next/dist/server/instrumentation/types";
import { sentryDsn } from "@/lib/sentry";

async function initSentryForThisRuntime() {
  if (!sentryDsn()) return;
  if (process.env.NEXT_RUNTIME === "edge") {
    const { initEdgeSentry } = await import("./sentry.edge.config");
    initEdgeSentry();
    return;
  }
  const { initServerSentry } = await import("./sentry.server.config");
  initServerSentry();
}

export async function register() {
  await initSentryForThisRuntime();
}

export const onRequestError: InstrumentationOnRequestError = async (error, request, context) => {
  if (!sentryDsn()) return;
  await initSentryForThisRuntime();
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(
    error,
    { path: request.path, method: request.method, headers: request.headers },
    {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  );
};
