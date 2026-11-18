import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FALLBACK_HOME_PROMPTS,
  HOME_ASK_PLACEHOLDER,
  HOME_CATEGORY_CHIPS,
  HOME_PROMPTS,
  homePromptHref,
  listingMatchesPrompt,
  promptsFromListings,
  type ListingExampleRow,
} from "@/lib/home-prompts";
import { prisma } from "@/lib/prisma";
import { searchCatalogue } from "@/lib/search";
import { parseNlQuery } from "@/lib/nl-query";

/** The public rows prisma/seed.ts inserts. Categories, towns, and types only. */
const SEED_ROWS: ListingExampleRow[] = [
  { category: "Food & restaurants", city: "Nairobi", type: "business" },
  { category: "Events & entertainment", city: "Nairobi", type: "business" },
  { category: "Events & entertainment", city: "Nairobi", type: "services" },
  { category: "Construction & trades", city: "Nairobi", type: "services" },
  { category: "Construction & trades", city: "Nairobi", type: "business" },
  { category: "Beauty & personal care", city: "Nairobi", type: "business" },
  { category: "Food & restaurants", city: "London", type: "business" },
  { category: "Transport & logistics", city: "Nairobi", type: "business" },
];

test("home prompt chips and the placeholder do not mention a funeral", () => {
  const text = [HOME_ASK_PLACEHOLDER, ...HOME_PROMPTS.flatMap((prompt) => [prompt.label, prompt.query])].join("\n");
  assert.equal(/funeral/i.test(text), false);
  assert.equal(HOME_PROMPTS.length >= 4, true);
  assert.match(homePromptHref(HOME_PROMPTS[0].query), /^\/listings\?nl=/);
  assert.equal(HOME_CATEGORY_CHIPS.length, 8);
  assert.equal(HOME_CATEGORY_CHIPS[0]?.href, "/listings");
  assert.equal(HOME_CATEGORY_CHIPS.at(-1)?.href, "/shops");

  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /promptsFromListings|HOME_PROMPTS/);
  assert.match(page, /HOME_ASK_PLACEHOLDER/);
  assert.equal(/funeral/i.test(page), false);
  assert.equal(text.includes("Fresh tilapia"), false);
});

test("every fallback example matches at least one seeded listing", () => {
  for (const prompt of FALLBACK_HOME_PROMPTS) {
    const hits = SEED_ROWS.filter((row) => listingMatchesPrompt(prompt.query, row));
    assert.ok(hits.length > 0, prompt.query);
  }
});

test("live examples are built from towns and categories that have listings", () => {
  const live = promptsFromListings(SEED_ROWS);
  assert.ok(live.length >= 4);
  for (const prompt of live) {
    assert.ok(SEED_ROWS.some((row) => listingMatchesPrompt(prompt.query, row)), prompt.query);
    assert.equal(/funeral/i.test(prompt.label + prompt.query), false);
    assert.equal(/tilapia/i.test(prompt.query), false);
  }
  assert.ok(live.some((prompt) => /ayie/i.test(prompt.query)));
  assert.ok(live.some((prompt) => /fundi/i.test(prompt.query)));
  assert.ok(live.some((prompt) => /dowry/i.test(prompt.query)));

  const kisumuOnly: ListingExampleRow[] = [
    { category: "Food & restaurants", city: "Kisumu", type: "business" },
    { category: "Construction & trades", city: "Kisumu", type: "services" },
    { category: "Events & entertainment", city: "Kisumu", type: "business" },
  ];
  const themed = promptsFromListings(kisumuOnly);
  assert.ok(themed.some((prompt) => prompt.query === "catering for an ayie in Kisumu"));
  assert.ok(themed.some((prompt) => prompt.query === "fundi in Kisumu"));
  assert.ok(themed.every((prompt) => kisumuOnly.some((row) => listingMatchesPrompt(prompt.query, row))));
  assert.equal(promptsFromListings([]).length, FALLBACK_HOME_PROMPTS.length);
});

test("each fallback example returns results from the search function", async () => {
  const stamp = Date.now().toString(36);
  const owner = await prisma.user.create({
    data: {
      email: `examples-${stamp}@example.com`,
      name: `Examples ${stamp}`,
      passwordHash: "x",
      city: "Nairobi",
    },
  });
  const specs = [
    { type: "business", title: `Catering ${stamp}`, category: "Food & restaurants", city: "Nairobi" },
    { type: "business", title: `DJ ${stamp}`, category: "Events & entertainment", city: "Nairobi" },
    { type: "services", title: `Fundi ${stamp}`, category: "Construction & trades", city: "Nairobi" },
    { type: "business", title: `Beauty ${stamp}`, category: "Beauty & personal care", city: "Nairobi" },
  ];
  const created = await Promise.all(
    specs.map((spec) =>
      prisma.listing.create({
        data: {
          ...spec,
          description: `Example listing ${stamp} for the homepage chips.`,
          region: "homeland",
          ownerId: owner.id,
        },
      }),
    ),
  );
  try {
    for (const prompt of FALLBACK_HOME_PROMPTS) {
      const parsed = parseNlQuery(prompt.query);
      const result = await searchCatalogue({
        city: parsed.city,
        category: parsed.category,
        type: parsed.type,
        pageSize: 50,
      });
      const ids = result.hits.flatMap((hit) => (hit.kind === "listing" ? [hit.listing.id] : []));
      const expected = created.filter((row) => listingMatchesPrompt(prompt.query, row));
      assert.ok(expected.length > 0, prompt.query);
      assert.ok(
        expected.some((row) => ids.includes(row.id)),
        `${prompt.query} missed ${expected.map((row) => row.title).join(", ")}`,
      );
    }
  } finally {
    await prisma.listing.deleteMany({ where: { ownerId: owner.id } });
    await prisma.user.delete({ where: { id: owner.id } });
  }
});
