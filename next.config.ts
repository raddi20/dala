import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import { remoteImagePatterns } from "./src/lib/image-hosts";
import { securityHeaders } from "./src/lib/security-headers";
import { sentrySourceMapsEnabled } from "./src/lib/sentry";

const sentryBrowserStub = "./src/lib/sentry-client-stub.ts";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "prisma", "@mux/mux-node", "sharp"],
  images: {
    remotePatterns: remoteImagePatterns(),
  },
  // Browser bundles resolve the SDK to an empty stub, with or without a DSN.
  // The server keeps the real package and forwards client reports from /api/errors.
  turbopack: {
    resolveAlias: {
      "@sentry/nextjs": {
        browser: sentryBrowserStub,
      },
    },
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@sentry/nextjs": path.join(process.cwd(), "src/lib/sentry-client-stub.ts"),
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
};

// The bundler plugin uploads source maps only when the token, org, and project
// are set. It is not loaded otherwise, so it does not inject OpenTelemetry into
// every server function. Instrumentation stays off even when it does wrap.
export default sentrySourceMapsEnabled()
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
      sourcemaps: { disable: false },
      buildTimeInstrumentation: false,
      webpack: {
        autoInstrumentServerFunctions: false,
        autoInstrumentMiddleware: false,
        autoInstrumentAppDirectory: false,
        treeshake: {
          removeDebugLogging: true,
          removeTracing: true,
          excludeReplayIframe: true,
          excludeReplayShadowDOM: true,
          excludeReplayCompressionWorker: true,
        },
      },
    })
  : nextConfig;
