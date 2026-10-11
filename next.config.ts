import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { remoteImagePatterns } from "./src/lib/image-hosts";
import { sentrySourceMapsEnabled } from "./src/lib/sentry";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["@prisma/client", "prisma", "@mux/mux-node", "sharp"],
  images: {
    remotePatterns: remoteImagePatterns(),
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
    ];
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT
// are all set. Replay code is left out of the client bundle.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !sentrySourceMapsEnabled(),
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
