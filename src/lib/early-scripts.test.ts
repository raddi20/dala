import assert from "node:assert/strict";
import test from "node:test";
import { earlyScriptSrcs, scriptHref } from "./early-scripts";

const layout = ["static/chunks/runtime.js", "static/chunks/main.js"];

test("the error boundary chunk is added and chunks already in the layout are not repeated", () => {
  const srcs = earlyScriptSrcs({
    "[project]/src/app/layout": layout,
    "[project]/src/app/error": [...layout, "static/chunks/error-boundary.js"],
    "[project]/src/app/global-error": [...layout, "static/immutable/chunks/global-error.js"],
    "[project]/src/app/not-found": [...layout, "static/chunks/error-boundary.js"],
  });
  assert.deepEqual(srcs, [
    "/_next/static/chunks/error-boundary.js",
    "/_next/static/immutable/chunks/global-error.js",
  ]);
});

test("a manifest path that already starts at _next is not doubled", () => {
  assert.equal(scriptHref("/_next/static/chunks/a.js"), "/_next/static/chunks/a.js");
  assert.equal(scriptHref("_next/static/chunks/a.js"), "/_next/static/chunks/a.js");
  assert.equal(earlyScriptSrcs({}).length, 0);
});
