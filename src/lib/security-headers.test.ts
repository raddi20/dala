import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../next.config";
import {
  BLOB_IMAGE_HOST,
  FLUTTERWAVE_CHECKOUT_HOST,
  contentSecurityPolicy,
  securityHeaders,
} from "./security-headers";

function headerMap(headers: { key: string; value: string }[]) {
  return new Map(headers.map((header) => [header.key, header.value]));
}

test("security headers are present and CSP stays report-only", () => {
  const headers = headerMap(securityHeaders());
  const csp = headers.get("Content-Security-Policy-Report-Only");
  assert.equal(csp, contentSecurityPolicy());
  assert.equal(headers.has("Content-Security-Policy"), false);
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.has("Strict-Transport-Security"), false);

  const permissions = headers.get("Permissions-Policy") ?? "";
  assert.match(permissions, /(?:^|, )camera=\(\)/);
  assert.match(permissions, /(?:^|, )microphone=\(self\)(?:,|$)/);
  assert.equal(permissions.includes("microphone=()"), false);
  assert.equal(permissions.includes("camera=(self)"), false);
  assert.match(permissions, /(?:^|, )geolocation=\(self\)(?:,|$)/);
  for (const name of ["payment", "usb", "bluetooth"]) {
    assert.match(permissions, new RegExp(`(?:^|, )${name}=\\(\\)`));
  }
});

// Every directive except microphone (Sulwe voice) and geolocation (Near me) is exactly what shipped before.
const EXPECTED_PERMISSIONS_POLICY =
  "accelerometer=(), autoplay=(), bluetooth=(), browsing-topics=(), camera=(), display-capture=(), " +
  "encrypted-media=(), fullscreen=(), geolocation=(self), gyroscope=(), hid=(), idle-detection=(), " +
  "magnetometer=(), microphone=(self), midi=(), payment=(), picture-in-picture=(), " +
  "publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=()";

test("Permissions-Policy allows the microphone and geolocation for self only and leaves every other directive unchanged", () => {
  const permissions = headerMap(securityHeaders()).get("Permissions-Policy");
  assert.equal(permissions, EXPECTED_PERMISSIONS_POLICY);
  const directives = (permissions ?? "").split(", ");
  assert.equal(directives.length, 21);
  assert.deepEqual(
    directives.filter((directive) => !directive.endsWith("=()")),
    ["geolocation=(self)", "microphone=(self)"],
  );
});

test("report-only CSP covers Blob, Mux, Flutterwave checkout, and self-hosted fonts", () => {
  const csp = contentSecurityPolicy();
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, new RegExp(`https://${BLOB_IMAGE_HOST.replace(/\./g, "\\.")}`));
  assert.equal(csp.includes("*.blob.vercel-storage.com"), false);
  assert.equal(csp.includes(`*.${BLOB_IMAGE_HOST}`), false);
  assert.match(csp, /https:\/\/image\.mux\.com/);
  assert.match(csp, /https:\/\/\*\.mux\.com/);
  assert.match(csp, /https:\/\/\*\.litix\.io/);
  assert.match(csp, /https:\/\/storage\.googleapis\.com/);
  assert.match(csp, new RegExp(`https://${FLUTTERWAVE_CHECKOUT_HOST.replace(/\./g, "\\.")}`));
  assert.match(csp, /font-src 'self'/);
  assert.equal(csp.includes("fonts.googleapis.com"), false);
  assert.equal(csp.includes("fonts.gstatic.com"), false);
});

test("next.config sends these headers on every path and hides x-powered-by", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  const rules = await nextConfig.headers?.();
  assert.ok(rules);
  const global = rules.find((rule) => rule.source === "/:path*");
  assert.ok(global);
  const headers = headerMap(global.headers);
  assert.equal(headers.get("Content-Security-Policy-Report-Only"), contentSecurityPolicy());
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(headers.get("Permissions-Policy")?.includes("camera=()"));
  assert.equal(headers.get("Permissions-Policy"), EXPECTED_PERMISSIONS_POLICY);

  const worker = rules.find((rule) => rule.source === "/sw.js");
  assert.equal(worker?.headers.some((header) => header.key === "Service-Worker-Allowed"), true);
  const manifest = rules.find((rule) => rule.source === "/manifest.webmanifest");
  assert.ok(manifest);
});
