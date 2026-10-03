import assert from "node:assert/strict";
import test from "node:test";
import { visitorActorHash } from "@/lib/ai/actor";
import type { SearchParse } from "@/lib/ai/prompts/smart-search";
import {
  applySearchParse,
  hasNonLatin,
  hasOccasionWord,
  interpretSearch,
  normalizeSearchQuery,
  searchQueryHash,
  shouldAskSmartSearch,
  type SearchCache,
} from "@/lib/ai/search-parse";
import type { RunResult } from "@/lib/ai/types";
import { parseNlQuery } from "@/lib/nl-query";

const chairs: SearchParse = {
  category: "Retail / shops",
  city: "Siaya",
  region: "homeland",
  occasion: "funerals",
  type: null,
  keywords: "chairs",
  language: "en",
  confidence: 0.9,
};

function memoryCache(): SearchCache & { saved: SearchParse[] } {
  const rows = new Map<string, { value: SearchParse; expiresAt: Date }>();
  const saved: SearchParse[] = [];
  return {
    saved,
    async get(queryKey, now) {
      const row = rows.get(queryKey);
      if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
      return row.value;
    },
    async put(queryKey, value, expiresAt) {
      rows.set(queryKey, { value, expiresAt });
      saved.push(value);
    },
  };
}

test("short queries and complete rule matches stay on the existing parser", () => {
  const housing = parseNlQuery("housing in London");
  assert.equal(shouldAskSmartSearch("housing in London", housing), false);
  assert.equal(shouldAskSmartSearch("food", parseNlQuery("food")), false);
  assert.equal(hasOccasionWord("wedding catering in Nairobi"), true);
  assert.equal(hasNonLatin("住房 in Nairobi"), true);
  assert.equal(shouldAskSmartSearch("wedding catering in Nairobi", parseNlQuery("wedding catering in Nairobi")), true);
  assert.equal(shouldAskSmartSearch("chairs in Siaya", parseNlQuery("chairs in Siaya")), true);
});

test("an unknown homeland town sets the region and is not a required text filter", () => {
  const rules = parseNlQuery("chairs in Siaya");
  assert.equal(rules.region, "homeland");
  assert.equal(rules.city, "");
  assert.equal(rules.q, "");
  assert.equal(rules.hints.includes("siaya"), false);
  assert.equal(rules.hints.includes("chairs"), true);
  const applied = applySearchParse(rules, chairs);
  assert.equal(applied.smart, true);
  assert.equal(applied.assist, "smart");
  assert.equal(applied.city, "");
  assert.equal(applied.region, "homeland");
  assert.equal(applied.q, "");
  assert.equal(applied.hints.includes("siaya"), false);
  assert.equal(applied.occasion, "funerals");
  assert.equal(applied.category, "Retail / shops");
  const weak = applySearchParse(rules, { ...chairs, confidence: 0.2 });
  assert.equal(weak.smart, false);
  assert.equal(weak.assist, "fallback");
  assert.equal(weak.occasion, "");
});

test("leftover time and place words do not become a hard text filter", () => {
  const catering = parseNlQuery("catering for a homecoming in Kisumu");
  assert.equal(catering.category, "Food & restaurants");
  assert.equal(catering.region, "homeland");
  assert.equal(catering.city, "");
  assert.equal(catering.q, "");
  assert.deepEqual(catering.hints, []);

  const dj = parseNlQuery("DJ for a wedding in Nairobi next month");
  assert.equal(dj.city, "Nairobi");
  assert.equal(dj.region, "homeland");
  assert.equal(dj.category, "Events & entertainment");
  assert.equal(dj.q, "");
  assert.equal(dj.hints.includes("next"), false);
  assert.equal(dj.hints.includes("month"), false);

  const roof = parseNlQuery("someone to fix my mum's roof in Siaya");
  assert.equal(roof.region, "homeland");
  assert.equal(roof.q, "");
  assert.equal(roof.hints.includes("roof"), true);
  assert.equal(roof.hints.includes("someone"), false);
  assert.equal(roof.summary.includes("someone to fix"), false);

  const housing = parseNlQuery("housing in London");
  assert.equal(housing.city, "London");
  assert.equal(housing.region, "diaspora");
  assert.equal(housing.q, "");
  assert.deepEqual(housing.hints, []);
});

test("rules are used when the model is off, and a cache hit does not call it again", async () => {
  let calls = 0;
  const cache = memoryCache();
  const now = new Date("2026-10-01T12:00:00Z");
  const run = async () => {
    calls += 1;
    const result: RunResult<SearchParse> = {
      ok: true,
      data: chairs,
      provider: "mock",
      model: "mock",
      costMicroUsd: 0,
      latencyMs: 1,
    };
    return result;
  };

  const skipped = await interpretSearch("housing in London", { now, run, cache });
  assert.equal(skipped.smart, false);
  assert.equal(skipped.assist, "rules");
  assert.equal(skipped.city, "London");
  assert.equal(calls, 0);

  const first = await interpretSearch("chairs in Siaya", { now, run, cache, actorHash: "abc" });
  assert.equal(first.smart, true);
  assert.equal(calls, 1);
  assert.equal(cache.saved.length, 1);

  const second = await interpretSearch("chairs in Siaya", { now, run, cache, actorHash: "abc" });
  assert.equal(second.smart, true);
  assert.equal(calls, 1);
  assert.equal(searchQueryHash(normalizeSearchQuery("chairs in Siaya")), searchQueryHash("chairs in siaya"));

  const disabled = await interpretSearch("tents for a funeral", {
    now,
    cache: memoryCache(),
    run: async () => ({ ok: false, kind: "disabled" }),
  });
  assert.equal(disabled.smart, false);
  assert.equal(disabled.assist, "fallback");
});

test("the visitor hash is not the raw cookie", () => {
  const hash = visitorActorHash("visitor1234567890", { STATS_SALT: "a-long-test-salt-value" } as unknown as NodeJS.ProcessEnv);
  assert.ok(hash);
  assert.notEqual(hash, "visitor1234567890");
  assert.equal(visitorActorHash("short", { STATS_SALT: "a-long-test-salt-value" } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(visitorActorHash("visitor1234567890", { STATS_SALT: "" } as unknown as NodeJS.ProcessEnv), null);
});
