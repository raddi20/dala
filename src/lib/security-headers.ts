/**
 * Response headers for every route.
 *
 * Content-Security-Policy is report-only. It does not block anything yet.
 * To enforce it later, once the browser console has been quiet for about two weeks:
 * 1. Rename the header below to Content-Security-Policy (drop "-Report-Only").
 * 2. Replace script-src 'unsafe-inline' with a per-request nonce from the Next.js
 *    proxy before enforcing. The App Router injects inline bootstrap scripts, so
 *    enforcing today's script-src would stop the page hydrating.
 * 3. Keep frame-ancestors 'self' together with X-Frame-Options: SAMEORIGIN.
 * 4. If Sentry is on, add its ingest host to connect-src before enforcing.
 *
 * Vercel already sends Strict-Transport-Security: max-age=63072000 on
 * www.rangach.co.ke, so this list does not add a second HSTS header.
 *
 * Fonts: next/font self-hosts Fraunces and Figtree. font-src is 'self' only.
 * Camera and microphone are unused (uploads are file pickers; shop video is playback).
 */

/** Live Rangach Blob store. Exact host, not a wildcard. */
export const BLOB_IMAGE_HOST = "yypodf6rvjgwdxyk.public.blob.vercel-storage.com";

export const FLUTTERWAVE_CHECKOUT_HOST = "checkout.flutterwave.com";

const OFF_FEATURES = [
  "accelerometer",
  "autoplay",
  "bluetooth",
  "browsing-topics",
  "camera",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "hid",
  "idle-detection",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "serial",
  "usb",
] as const;

export function contentSecurityPolicy() {
  const blob = `https://${BLOB_IMAGE_HOST}`;
  const checkout = `https://${FLUTTERWAVE_CHECKOUT_HOST}`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `form-action 'self' ${checkout}`,
    "script-src 'self' 'unsafe-inline' https://src.litix.io",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src 'self' data: blob: ${blob} https://image.mux.com https://*.litix.io`,
    "media-src 'self' blob: https://*.mux.com",
    `connect-src 'self' ${blob} https://*.mux.com https://*.litix.io https://storage.googleapis.com ${checkout}`,
    `frame-src 'self' ${checkout}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function permissionsPolicy() {
  return OFF_FEATURES.map((name) => `${name}=()`).join(", ");
}

export function securityHeaders() {
  return [
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy() },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: permissionsPolicy() },
  ];
}
