import assert from "node:assert/strict";
import test from "node:test";
import { fallbackNote, searchFallbackSteps, searchWithFallback } from "@/lib/search-fallback";

test("fallback drops town, then category, then the for sale filter", async () => {
  const calls: string[] = [];
  const outcome = await searchWithFallback(
    { city: "Nairobi", category: "Food & restaurants", type: "for_sale", q: "sofa" },
    async (next) => {
      calls.push([next.city || "-", next.category || "-", next.type || "-", next.q || "-"].join("|"));
      const opened = !next.city && !next.category && !next.type;
      return { total: opened ? 4 : 0 };
    },
  );
  assert.deepEqual(calls, [
    "Nairobi|Food & restaurants|for_sale|sofa",
    "-|Food & restaurants|for_sale|sofa",
    "-|-|for_sale|sofa",
    "-|-|-|sofa",
  ]);
  assert.equal(outcome.widened, true);
  assert.equal(outcome.note, "No exact matches in Nairobi, here's what's close");
  assert.equal(outcome.result.total, 4);
});

test("an exact hit is not widened", async () => {
  const calls: string[] = [];
  const outcome = await searchWithFallback({ city: "Nairobi", category: "Food & restaurants" }, async (next) => {
    calls.push(next.city || "-");
    return { total: 2 };
  });
  assert.deepEqual(calls, ["Nairobi"]);
  assert.equal(outcome.note, "");
  assert.equal(outcome.widened, false);
});

test("town is dropped first and the search stops once something matches", async () => {
  const calls: string[] = [];
  const outcome = await searchWithFallback(
    { city: "Kisumu", category: "Construction & trades", type: "services" },
    async (next) => {
      calls.push([next.city || "-", next.category || "-", next.type || "-"].join("|"));
      return { total: next.city ? 0 : 1 };
    },
  );
  assert.deepEqual(calls, ["Kisumu|Construction & trades|services", "-|Construction & trades|services"]);
  assert.equal(outcome.note, "No exact matches in Kisumu, here's what's close");
  assert.equal(searchFallbackSteps({ city: "Kisumu", category: "Construction & trades", type: "services" }).map((step) => step.dropped.join("+")).join(" / "), " / town / town+category");
});

test("a services search does not drop that type before the last widen", async () => {
  const calls: string[] = [];
  const outcome = await searchWithFallback({ city: "Kisumu", type: "services" }, async (next) => {
    calls.push([next.city || "-", next.type || "-"].join("|"));
    return { total: next.city || next.type ? 0 : 6 };
  });
  assert.deepEqual(calls, ["Kisumu|services", "-|services", "-|-"]);
  assert.equal(outcome.note, "No exact matches in Kisumu, here's what's close");
});

test("a search with no town still names what was widened", () => {
  assert.equal(fallbackNote(""), "No exact matches, here's what's close");
  assert.equal(fallbackNote("Nairobi"), "No exact matches in Nairobi, here's what's close");
  const steps = searchFallbackSteps({ category: "Retail / shops", type: "for_sale" });
  assert.deepEqual(
    steps.map((step) => ({ category: step.filters.category, type: step.filters.type })),
    [
      { category: "Retail / shops", type: "for_sale" },
      { category: "", type: "for_sale" },
      { category: "", type: "" },
    ],
  );
});
