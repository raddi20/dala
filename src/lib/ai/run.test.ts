import assert from "node:assert/strict";
import test from "node:test";
import type { AiConfig } from "@/lib/ai/config";
import { smartSearchPrompt } from "@/lib/ai/prompts/smart-search";
import { moderationPrompt } from "@/lib/ai/prompts/moderation";
import { createCircuit, runAi, type Circuit } from "@/lib/ai/run";
import { AiError, type AIProvider, type GenerateRequest, type GenerateResult, type ProviderName } from "@/lib/ai/types";
import type { UsageRow, UsageStore } from "@/lib/ai/usage";

function config(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    disabled: false,
    disabledReason: null,
    warnings: [],
    provider: "mock",
    geminiApiKey: "",
    openaiApiKey: "",
    compatBaseUrl: "",
    compatApiKey: "",
    compatVision: false,
    compatJsonMode: "json_schema",
    priceInPerM: 0,
    priceOutPerM: 0,
    modelPrimary: "mock",
    modelFast: "mock",
    modelOverrides: {},
    fallback: { provider: "openai", model: "gpt-6-luna" },
    timeoutMs: 8_000,
    maxRetries: 1,
    monthlyBudgetUsd: 10,
    mockMode: "ok",
    ...overrides,
  };
}

function memoryStore(spent = 0): UsageStore & { rows: UsageRow[] } {
  const rows: UsageRow[] = [];
  return {
    rows,
    async write(row) {
      rows.push(row);
    },
    async monthSpendMicro() {
      return spent;
    },
    async countSince() {
      return 0;
    },
  };
}

function provider(name: ProviderName, respond: (req: GenerateRequest<unknown>) => Promise<GenerateResult<unknown>> | never): AIProvider & { calls: number } {
  const api = {
    calls: 0,
    name,
    supportsImages: () => true,
    async generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      api.calls += 1;
      return respond(req as GenerateRequest<unknown>) as Promise<GenerateResult<T>>;
    },
  };
  return api;
}

function okResult(name: ProviderName): GenerateResult<{
  category: null;
  city: null;
  region: null;
  occasion: null;
  type: null;
  keywords: string;
  language: "en";
  confidence: number;
}> {
  return {
    data: {
      category: null,
      city: null,
      region: null,
      occasion: null,
      type: null,
      keywords: "",
      language: "en",
      confidence: 0,
    },
    usage: { inputTokens: 100, outputTokens: 50 },
    costMicroUsd: 0,
    provider: name,
    model: "mock",
    latencyMs: 5,
  };
}

function baseDeps(store: UsageStore, circuit: Circuit, providers: Record<string, AIProvider>, extra: Partial<AiConfig> = {}) {
  let now = Date.parse("2026-10-01T12:00:00Z");
  const sleeps: number[] = [];
  return {
    sleeps,
    deps: {
      config: config(extra),
      store,
      circuit,
      providers,
      featureOn: async () => true,
      random: () => 0,
      clock: {
        now: () => now,
        sleep: async (ms: number) => {
          sleeps.push(ms);
          now += ms;
        },
      },
    },
  };
}

test("a timeout uses the fallback provider and then the non-AI result when that also fails", async () => {
  const store = memoryStore();
  const primary = provider("mock", async (req) => {
    await new Promise<void>((_resolve, reject) => {
      req.signal?.addEventListener("abort", () => reject(new AiError("timeout", "aborted", true)));
    });
    return okResult("mock");
  });
  const fallback = provider("openai", async () => okResult("openai"));
  const { deps } = baseDeps(store, createCircuit(), { mock: primary, openai: fallback }, { timeoutMs: 30, maxRetries: 0 });
  const result = await runAi(smartSearchPrompt, { query: "chairs in Siaya" }, { actorHash: "abc" }, deps);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.provider, "openai");
  assert.equal(primary.calls, 1);
  assert.equal(fallback.calls, 1);
  assert.equal(store.rows.length, 2);
  assert.equal(store.rows[0]?.isFallback, false);
  assert.equal(store.rows[0]?.attempt, 1);
  assert.equal(store.rows[0]?.error, "timeout");
  assert.equal(store.rows[0]?.errorDetail, "The model timed out.");
  assert.equal(store.rows[1]?.isFallback, true);
  assert.equal(store.rows[1]?.attempt, 2);
  assert.equal(store.rows[1]?.ok, true);

  const nowhere = memoryStore();
  const hanging = provider("mock", async (req) => {
    await new Promise<void>((_resolve, reject) => {
      req.signal?.addEventListener("abort", () => reject(new AiError("timeout", "aborted", true)));
    });
    return okResult("mock");
  });
  const second = baseDeps(nowhere, createCircuit(), { mock: hanging }, { timeoutMs: 30, maxRetries: 0, fallback: null });
  const missed = await runAi(smartSearchPrompt, { query: "chairs" }, { actorHash: "abc" }, second.deps);
  assert.deepEqual(missed, { ok: false, kind: "timeout" });
});

test("429 Retry-After is waited inside the deadline", async () => {
  const store = memoryStore();
  let first = true;
  const primary = provider("mock", async () => {
    if (first) {
      first = false;
      throw new AiError("rate_limited", "slow", true, undefined, 500);
    }
    return okResult("mock");
  });
  const { deps, sleeps } = baseDeps(store, createCircuit(), { mock: primary }, { maxRetries: 1, fallback: null });
  const result = await runAi(smartSearchPrompt, { query: "food" }, { actorHash: "abc" }, deps);
  assert.equal(result.ok, true);
  assert.equal(sleeps[0], 500);
  assert.equal(primary.calls, 2);
});

test("invalid output is not retried for search and is retried once for moderation", async () => {
  const searchStore = memoryStore();
  const searchPrimary = provider("mock", async () => {
    throw new AiError("invalid_output", "bad", false, { inputTokens: 10, outputTokens: 4 });
  });
  const searchFallback = provider("openai", async () => okResult("openai"));
  const search = baseDeps(searchStore, createCircuit(), { mock: searchPrimary, openai: searchFallback }, { maxRetries: 2 });
  await runAi(smartSearchPrompt, { query: "food in Nairobi" }, { actorHash: "abc" }, search.deps);
  assert.equal(searchPrimary.calls, 1);
  assert.equal(searchFallback.calls, 1);

  const batchStore = memoryStore();
  let tries = 0;
  const batchPrimary = provider("mock", async () => {
    tries += 1;
    if (tries < 2) throw new AiError("invalid_output", "bad", false, { inputTokens: 8, outputTokens: 2 });
    return {
      data: { flags: [], suggestedCategory: null },
      usage: { inputTokens: 8, outputTokens: 2 },
      costMicroUsd: 0,
      provider: "mock",
      model: "mock",
      latencyMs: 1,
    };
  });
  const batch = baseDeps(batchStore, createCircuit(), { mock: batchPrimary }, { maxRetries: 0, fallback: null });
  const moderated = await runAi(moderationPrompt, { text: "sofa" }, { userId: "seller" }, batch.deps);
  assert.equal(moderated.ok, true);
  assert.equal(batchPrimary.calls, 2);
  assert.equal(batchStore.rows.filter((row) => row.error === "invalid_output").length, 1);
  assert.equal(batchStore.rows.at(-1)?.ok, true);
});

test("the circuit opens after five failures and closes after it recovers", async () => {
  const circuit = createCircuit();
  const primary = provider("mock", async () => {
    throw new AiError("server", "down", true);
  });
  const fallback = provider("openai", async () => okResult("openai"));
  for (let i = 0; i < 5; i += 1) {
    const store = memoryStore();
    const { deps } = baseDeps(store, circuit, { mock: primary, openai: fallback }, { maxRetries: 0, fallback: null });
    const result = await runAi(smartSearchPrompt, { query: "food" }, { actorHash: "abc" }, deps);
    assert.equal(result.ok, false);
  }
  assert.equal(primary.calls, 5);
  const store = memoryStore();
  const opened = baseDeps(store, circuit, { mock: primary, openai: fallback }, { maxRetries: 0 });
  const skipped = await runAi(smartSearchPrompt, { query: "food" }, { actorHash: "abc" }, opened.deps);
  assert.equal(skipped.ok, true);
  assert.equal(primary.calls, 5);
  assert.equal(fallback.calls, 1);

  circuit.openUntil = 0;
  circuit.failures = [];
  const again = provider("mock", async () => okResult("mock"));
  const closed = baseDeps(memoryStore(), circuit, { mock: again }, { maxRetries: 0, fallback: null });
  const recovered = await runAi(smartSearchPrompt, { query: "food" }, { actorHash: "abc" }, closed.deps);
  assert.equal(recovered.ok, true);
  assert.equal(again.calls, 1);
});

test("over budget makes no provider call", async () => {
  const store = memoryStore(10_000_000);
  const primary = provider("mock", async () => okResult("mock"));
  const { deps } = baseDeps(store, createCircuit(), { mock: primary });
  const result = await runAi(smartSearchPrompt, { query: "food" }, { actorHash: "abc" }, deps);
  assert.deepEqual(result, { ok: false, kind: "over_budget" });
  assert.equal(primary.calls, 0);
  assert.equal(store.rows.length, 0);
});

test("production with no Gemini key and unset flags stays disabled and makes no call", async () => {
  const primary = provider("gemini", async () => okResult("gemini"));
  const result = await runAi(
    smartSearchPrompt,
    { query: "chairs in Siaya" },
    { actorHash: "visitor" },
    {
      env: { NODE_ENV: "production", VERCEL_ENV: "production" } as NodeJS.ProcessEnv,
      providers: { gemini: primary },
      featureOn: async () => {
        throw new Error("flags must not be read after a missing key disables AI");
      },
    },
  );
  assert.deepEqual(result, { ok: false, kind: "disabled" });
  assert.equal(primary.calls, 0);
});

test("unset flags disable a feature even when a key is present", async () => {
  const primary = provider("gemini", async () => okResult("gemini"));
  const result = await runAi(
    smartSearchPrompt,
    { query: "chairs in Siaya" },
    { actorHash: "visitor" },
    {
      env: {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        GEMINI_API_KEY: "test-key",
      } as NodeJS.ProcessEnv,
      providers: { gemini: primary },
    },
  );
  assert.deepEqual(result, { ok: false, kind: "disabled" });
  assert.equal(primary.calls, 0);
});

test("one usage row is written per attempt", async () => {
  const store = memoryStore();
  let first = true;
  const primary = provider("mock", async () => {
    if (first) {
      first = false;
      throw new AiError("server", "down", true);
    }
    return okResult("mock");
  });
  const { deps } = baseDeps(store, createCircuit(), { mock: primary }, { maxRetries: 1, fallback: null });
  const result = await runAi(smartSearchPrompt, { query: "food" }, { actorHash: "visitor", userId: "" }, deps);
  assert.equal(result.ok, true);
  assert.equal(store.rows.length, 2);
  assert.equal(store.rows[0]?.attempt, 1);
  assert.equal(store.rows[0]?.isFallback, false);
  assert.equal(store.rows[0]?.ok, false);
  assert.equal(store.rows[1]?.attempt, 2);
  assert.equal(store.rows[1]?.ok, true);
  assert.equal(store.rows[1]?.promptVersion, "smart_search@1");
});
