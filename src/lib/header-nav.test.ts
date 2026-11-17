import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the laptop nav keeps the full logo and moves secondary links into More", () => {
  const header = readFileSync(new URL("../components/header.tsx", import.meta.url), "utf8");
  assert.match(header, /shrink-0/);
  assert.match(header, /truncate=\{false\}/);
  assert.match(header, /\bMore\b/);
  assert.match(header, /List your business free/);
  assert.match(header, /href="\/saved"/);
  assert.match(header, /InstallAppLink/);
  assert.match(header, /md:hidden/);
  const details = header.slice(header.indexOf("<details"), header.indexOf("</details>"));
  assert.match(details, /For the diaspora/);
  assert.match(details, /Send home/);
  assert.match(details, /href="\/saved"/);
  assert.match(header, /hidden xl:inline-flex/);
});
