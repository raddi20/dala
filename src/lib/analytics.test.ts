import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contentSecurityPolicy } from "@/lib/security-headers";
import { mayStoreResponse, planRequest } from "@/lib/sw-policy";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Vercel Web Analytics renders once in the root layout, without Speed Insights", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /import \{ Analytics \} from "@vercel\/analytics\/next";/);
  assert.equal(layout.match(/<Analytics \/>/g)?.length, 1);
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.dependencies["@vercel/analytics"]);
  assert.equal(JSON.stringify(pkg).includes("speed-insights"), false);
});

test("the CSP allows the same-origin insights script and beacon", () => {
  const csp = contentSecurityPolicy();
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
});

test("the service worker never stores /_vercel/insights requests", () => {
  const base = { method: "GET", sameOrigin: true, hostname: "rangach.co.ke", hasRange: false, serverAction: false };
  const script = planRequest({ ...base, pathname: "/_vercel/insights/script.js", mode: "no-cors", destination: "script" });
  assert.equal(mayStoreResponse(script), false);
  const view = planRequest({ ...base, method: "POST", pathname: "/_vercel/insights/view", mode: "cors", destination: "" });
  assert.deepEqual(view, { kind: "bypass", reason: "non-get" });
});

test("the proxy skips /_vercel and the privacy page names Vercel Web Analytics", () => {
  assert.match(read("src/proxy.ts"), /\(\?!_next\/static\|_next\/image\|_vercel\|/);
  assert.match(read("src/app/privacy/page.tsx"), /Vercel Web Analytics[^<]*no cookies[^<]*aggregated/);
});
