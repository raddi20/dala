import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod/v4";
import { GEMINI_SCHEMA_KEYWORDS, jsonSchemaKeywords, toProviderJsonSchema } from "@/lib/ai/json-schema";
import { listingSuggestionSchema } from "@/lib/ai/prompts/listing-writer";
import { ALL_PROMPTS } from "@/lib/ai/prompts/index";

const ALLOWED = new Set<string>(GEMINI_SCHEMA_KEYWORDS);

test("every AI feature schema stays inside Gemini's keyword allowlist", () => {
  assert.equal(ALL_PROMPTS.length, 5);
  for (const prompt of ALL_PROMPTS) {
    const schema = toProviderJsonSchema(prompt.schema);
    const found = jsonSchemaKeywords(schema);
    for (const key of found) {
      assert.equal(ALLOWED.has(key), true, `${prompt.feature} uses ${key}`);
    }
    assert.equal(found.includes("const"), false, prompt.feature);
    assert.equal(schema.additionalProperties, false);
  }
});

test("a literal is sent as a one-value enum", () => {
  const schema = toProviderJsonSchema(z.object({ ok: z.literal(true) }));
  const ok = (schema.properties as { ok: { enum?: unknown[]; const?: unknown } }).ok;
  assert.deepEqual(ok.enum, [true]);
  assert.equal(Object.prototype.hasOwnProperty.call(ok, "const"), false);
  for (const key of jsonSchemaKeywords(schema)) assert.equal(ALLOWED.has(key), true, key);
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
