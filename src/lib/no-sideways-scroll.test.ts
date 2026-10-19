import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsSearchBar } from "@/components/results-chrome";

test("the results search bar can shrink to a phone screen, so /listings does not scroll sideways", () => {
  const html = renderToStaticMarkup(
    createElement(ResultsSearchBar, {
      action: "/listings",
      inputId: "nl",
      inputName: "nl",
      defaultValue: "",
      label: "Search in a sentence",
      sheet: createElement("span", null, "Filters"),
      pills: ["Homeland", "Diaspora", "Checked", "Shops"].map((label) => createElement("a", { key: label, href: "/listings" }, label)),
    }),
  );
  const root = html.match(/^<div class="([^"]+)"/)?.[1] ?? "";
  assert.match(root, /results-search-bar/);
  // It sits in a grid (/listings) or flex column (/shops). Without min-w-0 its min width is the nowrap pill row.
  assert.ok(root.split(" ").includes("min-w-0"), root);
  assert.match(html, /class="chip-scroll min-w-0 flex-1"/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const chips = css.slice(css.indexOf(".chip-scroll {"), css.indexOf("}", css.indexOf(".chip-scroll {")));
  assert.match(chips, /overflow-x:\s*auto/);
  // The fix is at the source, not by clipping the page.
  assert.doesNotMatch(css, /(html|body)\s*\{[^}]*overflow-x:\s*hidden/);
});
