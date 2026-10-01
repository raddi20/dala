import assert from "node:assert/strict";
import test from "node:test";
import { toProviderJsonSchema } from "@/lib/ai/json-schema";
import { listingSuggestionSchema } from "@/lib/ai/prompts/listing-writer";
import { ALL_PROMPTS } from "@/lib/ai/prompts/index";

const BANNED = ["pattern", "format", "minLength", "maxLength", "minimum", "maximum", "$schema"];

function keys(node: unknown, found: string[]) {
  if (Array.isArray(node)) {
    for (const item of node) keys(item, found);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key !== "properties") found.push(key);
    if (key === "properties" && value && typeof value === "object") {
      for (const child of Object.values(value as Record<string, unknown>)) keys(child, found);
      continue;
    }
    keys(value, found);
  }
}

test("every feature schema converts and avoids unsupported keywords", () => {
  assert.equal(ALL_PROMPTS.length, 5);
  for (const prompt of ALL_PROMPTS) {
    const schema = toProviderJsonSchema(prompt.schema);
    const found: string[] = [];
    keys(schema, found);
    for (const banned of BANNED) assert.equal(found.includes(banned), false, `${prompt.feature} uses ${banned}`);
    assert.equal(schema.additionalProperties, false);
  }
});

test("an invented category is rejected by the listing schema", () => {
  const sample = {
    title: "Sofa",
    description: "A sofa.",
    category: "Not a category",
    type: "for_sale",
    price: { amount: null, currency: null, label: "", fromInput: false },
    language: "en",
    confidence: "low",
    warnings: [],
  };
  assert.equal(listingSuggestionSchema.safeParse(sample).success, false);
  const invented = { ...sample, category: "Spaceships" };
  assert.equal(listingSuggestionSchema.safeParse(invented).success, false);
  const real = { ...sample, category: "Home & furniture" };
  assert.equal(listingSuggestionSchema.safeParse(real).success, true);
});
