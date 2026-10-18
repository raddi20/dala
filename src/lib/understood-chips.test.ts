import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DROPPED_WORDS_NOTE, matchCountLabel, understoodChips } from "@/lib/understood-chips";

test("removing an understood chip drops that filter and the sentence", () => {
  const filters = {
    nl: "catering for an ayie in Kisumu for 200",
    region: "homeland",
    category: "Food & restaurants",
    occasion: "weddings-dowry",
    verified: "1",
  };
  const chips = understoodChips("/listings", filters, ["kisumu"]);
  const region = chips.find((chip) => chip.key === "region");
  assert.ok(region);
  assert.equal(region.label, "Homeland");
  assert.equal(region.href.includes("nl="), false);
  assert.equal(region.href.includes("region="), false);
  assert.ok(region.href.includes("category="));
  assert.ok(region.href.includes("occasion=weddings-dowry"));
  assert.ok(region.href.includes("verified=1"));

  const hints = chips.find((chip) => chip.key === "hints");
  assert.ok(hints);
  assert.equal(hints.label, "kisumu");
  assert.equal(hints.href.includes("nl="), false);
  assert.ok(hints.href.includes("region=homeland"));
  assert.ok(hints.href.includes("verified=1"));

  const townFilters = { ...filters, city: "Kisumu" };
  const town = understoodChips("/listings", townFilters).find((chip) => chip.key === "city");
  assert.ok(town);
  assert.equal(town.label, "Kisumu");
  const nairobi = understoodChips("/listings", { city: "Nairobi", region: "homeland" }).find((chip) => chip.key === "city");
  assert.equal(nairobi?.label, "Nairobi");

  const occasion = chips.find((chip) => chip.key === "occasion");
  assert.ok(occasion);
  assert.match(occasion.label, /ayie/i);
  assert.doesNotMatch(occasion.label, /funeral/i);
});

test("match count and the dropped-words note stay plain", () => {
  assert.equal(matchCountLabel(0, 1, 24), "0 matches");
  assert.equal(matchCountLabel(1, 1, 24), "1 match");
  assert.equal(matchCountLabel(4, 1, 24), "4 matches");
  assert.equal(matchCountLabel(30, 2, 24), "25–30 of 30 matches");
  assert.doesNotMatch(DROPPED_WORDS_NOTE, /funeral/i);
  assert.doesNotMatch(DROPPED_WORDS_NOTE, /checked sellers first/i);
});

test("search result copy does not use a funeral example", () => {
  const files = [
    "../app/listings/page.tsx",
    "../app/shops/page.tsx",
    "../components/shops-directory.tsx",
    "../components/browse-hits.tsx",
    "../components/results-chrome.tsx",
    "../components/shop-result-row.tsx",
    "../lib/occasion-needs.ts",
    "../lib/understood-chips.ts",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /funeral/i, file);
  }
});
