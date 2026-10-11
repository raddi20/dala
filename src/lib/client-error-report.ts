import { scrubText } from "@/lib/sentry";

/** Reject anything larger than 16 KB before it is parsed or forwarded. */
export const CLIENT_ERROR_BODY_LIMIT = 16 * 1024;

const LIMITS = {
  message: 2_000,
  stack: 4_000,
  digest: 200,
  href: 500,
} as const;

export type ClientErrorReport = {
  message: string;
  stack: string;
  digest: string;
  href: string;
};

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return scrubText(value).slice(0, max);
}

/** Accept only the four fields the browser sends, with emails and phones removed. */
export function parseClientErrorReport(
  raw: string,
): { ok: true; report: ClientErrorReport } | { ok: false; status: 400 | 413 } {
  if (raw.length > CLIENT_ERROR_BODY_LIMIT) return { ok: false, status: 413 };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400 };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, status: 400 };
  const record = body as Record<string, unknown>;
  const message = clip(record.message, LIMITS.message);
  if (!message) return { ok: false, status: 400 };
  return {
    ok: true,
    report: {
      message,
      stack: clip(record.stack, LIMITS.stack),
      digest: clip(record.digest, LIMITS.digest),
      href: clip(record.href, LIMITS.href),
    },
  };
}
