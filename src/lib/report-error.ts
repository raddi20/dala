const MESSAGE_LIMIT = 2_000;
const STACK_LIMIT = 4_000;
const DIGEST_LIMIT = 200;
const HREF_LIMIT = 500;

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function pageHref() {
  if (typeof location === "undefined") return "";
  return `${location.origin}${location.pathname}`.slice(0, HREF_LIMIT);
}

function payloadFor(error: unknown) {
  const message =
    error instanceof Error ? text(error.message, MESSAGE_LIMIT) : text(String(error), MESSAGE_LIMIT);
  const stack = error instanceof Error ? text(error.stack, STACK_LIMIT) : "";
  let digest = "";
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string") {
    digest = text(error.digest, DIGEST_LIMIT);
  }
  return {
    message: message || "Unknown error",
    stack,
    digest,
    href: pageHref(),
  };
}

const recent = new Set<string>();

/** Posts a crash to our server. The browser never loads the Sentry SDK. */
export function reportError(error: unknown) {
  if (typeof window === "undefined") return;
  const payload = payloadFor(error);
  const key = `${payload.message}\n${payload.digest}\n${payload.stack.slice(0, 180)}`;
  if (recent.has(key)) return;
  recent.add(key);
  window.setTimeout(() => recent.delete(key), 2_000);

  const body = JSON.stringify(payload);
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/errors", blob)) return;
    }
  } catch {
    // fetch below
  }
  void fetch("/api/errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function installClientErrorReporting() {
  if (typeof window === "undefined") return;
  const marked = window as Window & { __rangachClientErrors?: boolean };
  if (marked.__rangachClientErrors) return;
  marked.__rangachClientErrors = true;
  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason);
  });
}
