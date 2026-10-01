import assert from "node:assert/strict";
import test from "node:test";
import { listingSuggestionSchema, type ListingSuggestion } from "@/lib/ai/prompts/listing-writer";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { AiError, type GenerateRequest } from "@/lib/ai/types";

function request(): GenerateRequest<ListingSuggestion> {
  return {
    feature: "listing_writer",
    model: "mock",
    system: "sys",
    text: "sofa",
    images: [{ mimeType: "image/jpeg", data: new Uint8Array([1]) }],
    schema: listingSuggestionSchema,
    schemaName: "listing_suggestion",
    maxOutputTokens: 50,
    timeoutMs: 1000,
  };
}

test("mock returns a valid fixture with zero cost", async () => {
  const result = await createMockProvider("ok").generateStructured(request());
  assert.equal(result.costMicroUsd, 0);
  assert.equal(result.usage.inputTokens, 100);
  assert.equal(result.usage.outputTokens, 50);
  assert.equal(result.data.category, "Home & furniture");
});

test("mock invalid mode fails the schema and timeout mode aborts", async () => {
  await assert.rejects(() => createMockProvider("invalid").generateStructured(request()), (error: unknown) => {
    assert.ok(error instanceof AiError);
    assert.equal(error.kind, "invalid_output");
    return true;
  });
  const controller = new AbortController();
  const pending = createMockProvider("timeout").generateStructured({ ...request(), signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof AiError);
    assert.equal(error.kind, "timeout");
    return true;
  });
});
