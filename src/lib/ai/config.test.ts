import assert from "node:assert/strict";
import test from "node:test";
import { readAiConfig, isProductionRuntime } from "@/lib/ai/config";
import { resolveModel } from "@/lib/ai/registry";

test("a missing key in production disables AI and does not select mock", () => {
  const config = readAiConfig({ NODE_ENV: "production", VERCEL_ENV: "production" });
  assert.equal(config.disabled, true);
  assert.equal(config.provider === "mock", false);
  assert.match(config.disabledReason ?? "", /key/i);
});

test("mock is refused in production and allowed on Preview", () => {
  const production = readAiConfig({ NODE_ENV: "production", VERCEL_ENV: "production", AI_PROVIDER: "mock" });
  assert.equal(production.disabled, true);
  assert.match(production.disabledReason ?? "", /refused/);
  assert.equal(isProductionRuntime({ VERCEL_ENV: "preview", NODE_ENV: "production" }), false);
  const preview = readAiConfig({ NODE_ENV: "production", VERCEL_ENV: "preview", AI_PROVIDER: "mock" });
  assert.equal(preview.disabled, false);
  assert.equal(preview.provider, "mock");
});

test("openai_compat without a base URL or prices is disabled", () => {
  const missingUrl = readAiConfig({
    NODE_ENV: "production",
    AI_PROVIDER: "openai_compat",
    AI_PRICE_IN_PER_M: "0.15",
    AI_PRICE_OUT_PER_M: "0.60",
    AI_MODEL_PRIMARY: "model",
    AI_MODEL_FAST: "model",
  });
  assert.equal(missingUrl.disabled, true);
  assert.match(missingUrl.disabledReason ?? "", /AI_BASE_URL/);
  const missingPrice = readAiConfig({
    NODE_ENV: "production",
    AI_PROVIDER: "openai_compat",
    AI_BASE_URL: "http://127.0.0.1:11434/v1",
    AI_MODEL_PRIMARY: "model",
    AI_MODEL_FAST: "model",
  });
  assert.equal(missingPrice.disabled, true);
  assert.match(missingPrice.disabledReason ?? "", /PRICE/);
});

test("a per-feature model override wins over the tier default", () => {
  const config = readAiConfig({
    NODE_ENV: "test",
    AI_PROVIDER: "mock",
    AI_MODEL_PRIMARY: "gemini-3.5-flash-lite",
    AI_MODEL_FAST: "gemini-3.1-flash-lite",
    AI_MODEL_LISTING_WRITER: "custom-writer",
  });
  assert.equal(resolveModel("listing_writer", config), "custom-writer");
  assert.equal(resolveModel("smart_search", config), "gemini-3.1-flash-lite");
  assert.equal(resolveModel("moderation", config), "gemini-3.5-flash-lite");
});
