/**
 * Sentry stays idle unless a DSN is set. Nothing is sent during local dev or
 * on Vercel until Kevin adds the variables below.
 *
 *   NEXT_PUBLIC_SENTRY_DSN  browser and server (public, baked in at build)
 *   SENTRY_DSN              server only; used when the public DSN is unset
 *   SENTRY_ORG              org slug, only for source map upload
 *   SENTRY_PROJECT          project slug, only for source map upload
 *   SENTRY_AUTH_TOKEN       upload token. Source maps are skipped without it.
 *
 * tracesSampleRate is 5%. Session Replay is not enabled.
 */

export const SENTRY_TRACE_SAMPLE_RATE = 0.05;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+\d(?:[\s().-]?\d){7,14}|\b254\d{8,12}\b|\b0[17]\d(?:[\s-]?\d){7}\b)/gi;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "email",
  "ip_address",
  "mobile",
  "phone",
  "phonenumber",
  "set-cookie",
  "tel",
  "telephone",
  "whatsapp",
]);

export function sentryDsn() {
  const server = process.env.SENTRY_DSN?.trim() ?? "";
  const pub = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";
  return server || pub;
}

/** Source maps are uploaded only when the token, org, and project are all set. */
export function sentrySourceMapsEnabled() {
  return Boolean(
    process.env.SENTRY_AUTH_TOKEN?.trim() && process.env.SENTRY_ORG?.trim() && process.env.SENTRY_PROJECT?.trim(),
  );
}

export function scrubText(value: string) {
  return value.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

export function scrubSentryValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[trimmed]";
  if (typeof value === "string") return scrubText(value);
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => scrubSentryValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[Filtered]";
      continue;
    }
    out[key] = scrubSentryValue(item, depth + 1);
  }
  return out;
}

/** Drop emails, phones, cookies, and IP addresses before an event leaves the server. */
export function scrubSentryEvent<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  return scrubSentryValue(event) as T;
}

export function sentryInitOptions() {
  return {
    dsn: sentryDsn(),
    tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
      queues: false,
    },
  };
}
