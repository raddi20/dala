import assert from "node:assert/strict";
import test from "node:test";
import { assertAdapterContract, request, scriptedFetch } from "@/lib/ai/providers/contract";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";

function create(fetchImpl: typeof fetch, extra?: { vision?: boolean; jsonMode?: "json_schema" | "json_object" }) {
  return createOpenAICompatibleProvider({
    apiKey: "",
    baseURL: "http://127.0.0.1:11434/v1",
    vision: extra?.vision ?? true,
    jsonMode: extra?.jsonMode ?? "json_schema",
    priceInPerM: 0.15,
    priceOutPerM: 0.6,
    fetchImpl,
  });
}

test("openai compatible adapter maps HTTP fixtures", async () => {
  await assertAdapterContract((fetchImpl) => create(fetchImpl), {
    url: "chat/completions",
    usage: { input: 11, output: 6 },
  });
});

test("vision off sends text only, and json_object appends the schema", async () => {
  const blind = { url: "", body: "" };
  await create(scriptedFetch("ok", blind), { vision: false }).generateStructured(request());
  assert.equal(blind.body.includes("image_url"), false);
  assert.match(blind.body, /hello/);

  const objectMode = { url: "", body: "" };
  await create(scriptedFetch("ok", objectMode), { jsonMode: "json_object" }).generateStructured(request());
  assert.match(objectMode.body, /json_object/);
  assert.match(objectMode.body, /listing_suggestion|title/);
});
