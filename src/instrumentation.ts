import type { InstrumentationOnRequestError } from "next/dist/server/instrumentation/types";
import { sentryDsn } from "@/lib/sentry";

export async function register() {
  if (!sentryDsn()) return;
  if (process.env.NEXT_RUNTIME === "edge") {
    const { initEdgeSentry } = await import("./sentry.edge.config");
    initEdgeSentry();
    return;
  }
  const { initServerSentry } = await import("./sentry.server.config");
  initServerSentry();
}

export const onRequestError: InstrumentationOnRequestError = async (error, request, context) => {
  if (!sentryDsn()) return;
  const details = {
    request: { path: request.path, method: request.method, headers: request.headers },
    context: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  };
  if (process.env.NEXT_RUNTIME === "edge") {
    const { captureEdgeRequestError } = await import("./sentry.edge.config");
    captureEdgeRequestError(error, details.request, details.context);
    return;
  }
  const { captureNodeRequestError } = await import("./sentry.server.config");
  captureNodeRequestError(error, details.request, details.context);
};
