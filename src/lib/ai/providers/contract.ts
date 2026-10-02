import assert from "node:assert/strict";
import { z } from "zod/v4";
import { AiError, type AIProvider, type GenerateRequest } from "@/lib/ai/types";

const schema = z.object({ title: z.string() });
const image = new Uint8Array([1, 2, 3, 4]);

export function request(): GenerateRequest<{ title: string }> {
  return {
    feature: "listing_writer",
    model: "test-model",
    system: "sys",
    text: "hello",
    images: [{ mimeType: "image/jpeg", data: image }],
    schema,
    schemaName: "listing_suggestion",
    maxOutputTokens: 40,
    timeoutMs: 1000,
  };
}

type Mode = "ok" | "429" | "500" | "401" | "bad-json" | "no-usage";

export function scriptedFetch(mode: Mode, sink: { url: string; body: string }): typeof fetch {
  return async (url, init) => {
    sink.url = String(url);
    sink.body = String(init?.body ?? "");
    const headers = new Headers({ "content-type": "application/json" });
    if (mode === "429") {
      headers.set("retry-after", "2");
      return new Response(JSON.stringify({ error: { message: "slow" } }), { status: 429, headers });
    }
    if (mode === "500") return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500, headers });
    if (mode === "401") return new Response(JSON.stringify({ error: { message: "nope" } }), { status: 401, headers });
    if (sink.url.includes("googleapis")) return new Response(JSON.stringify(geminiBody(mode)), { status: 200, headers });
    if (sink.url.includes("chat/completions")) return new Response(JSON.stringify(chatBody(mode)), { status: 200, headers });
    return new Response(JSON.stringify(openaiBody(mode)), { status: 200, headers });
  };
}

function geminiBody(mode: Mode) {
  if (mode === "bad-json") {
    return { candidates: [{ content: { parts: [{ text: "not-json" }], role: "model" }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1, thoughtsTokenCount: 0 } };
  }
  if (mode === "no-usage") {
    return { candidates: [{ content: { parts: [{ text: '{"title":"ok"}' }], role: "model" }, finishReason: "STOP" }] };
  }
  return {
    candidates: [{ content: { parts: [{ text: '{"title":"ok"}' }], role: "model" }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 1 },
  };
}

function openaiBody(mode: Mode) {
  const text = mode === "bad-json" ? "not-json" : '{"title":"ok"}';
  const body: Record<string, unknown> = {
    id: "resp_1",
    object: "response",
    status: "completed",
    output_text: text,
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }],
  };
  if (mode !== "no-usage") body.usage = { input_tokens: 10, output_tokens: 5 };
  return body;
}

function chatBody(mode: Mode) {
  const text = mode === "bad-json" ? "not-json" : '{"title":"ok"}';
  const body: Record<string, unknown> = {
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 1,
    model: "test-model",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
  };
  if (mode !== "no-usage") body.usage = { prompt_tokens: 11, completion_tokens: 6 };
  return body;
}

export async function assertAdapterContract(create: (fetchImpl: typeof fetch) => AIProvider, expect: { url: string; usage: { input: number; output: number } }) {
  const sink = { url: "", body: "" };
  const ok = create(scriptedFetch("ok", sink));
  const result = await ok.generateStructured(request());
  assert.equal(result.data.title, "ok");
  assert.equal(result.usage.inputTokens, expect.usage.input);
  assert.equal(result.usage.outputTokens, expect.usage.output);
  assert.equal(result.usage.estimated, undefined);
  assert.match(sink.url, new RegExp(expect.url));
  assert.match(sink.body, /AQIDBA==/);

  await expectKind(create, "429", "rate_limited");
  await expectKind(create, "500", "server");
  await expectKind(create, "401", "auth");
  const bad = await expectKind(create, "bad-json", "invalid_output");
  assert.ok(bad instanceof AiError && bad.usage);

  const missing = { url: "", body: "" };
  const estimated = await create(scriptedFetch("no-usage", missing)).generateStructured(request());
  assert.equal(estimated.data.title, "ok");
  assert.equal(estimated.usage.estimated, true);
  assert.ok(estimated.usage.inputTokens > 0);
}

async function expectKind(create: (fetchImpl: typeof fetch) => AIProvider, mode: Mode, kind: string) {
  const sink = { url: "", body: "" };
  try {
    await create(scriptedFetch(mode, sink)).generateStructured(request());
    assert.fail(`expected ${kind}`);
  } catch (error) {
    assert.ok(error instanceof AiError, mode);
    assert.equal(error.kind, kind);
    if (kind === "rate_limited") assert.equal(error.retryAfterMs, 2000);
    return error;
  }
}
