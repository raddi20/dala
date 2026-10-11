/**
 * Browser builds alias `@sentry/nextjs` to this file.
 * The real SDK stays on the server. These exports exist so a stray client
 * import cannot pull the package in.
 */

export function init() {
  return undefined;
}

export function isInitialized() {
  return false;
}

export function captureException() {
  return "";
}

export function captureMessage() {
  return "";
}

export function captureRequestError() {}

export function captureRouterTransitionStart() {}
