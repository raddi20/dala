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
  const menu = header.slice(header.indexOf("<HeaderMore"), header.indexOf("</HeaderMore>"));
  assert.match(menu, /For the diaspora/);
  assert.match(menu, /Send home/);
  assert.match(menu, /href="\/saved"/);
  assert.match(header, /hidden xl:inline-flex/);
  const more = readFileSync(new URL("../components/header-more.tsx", import.meta.url), "utf8");
  assert.match(more, /aria-expanded=\{open\}/);
  assert.match(more, /aria-controls=\{menuId\}/);
  assert.match(more, /event\.key !== "Escape"/);
});
