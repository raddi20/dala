import type { ProviderName } from "@/lib/ai/types";

export type ModelPrice = {
  inPerM: number;
  outPerM: number;
  batchFactor: number;
};

/** USD per 1M tokens. Batch is half price where the provider publishes a batch rate. */
export const PRICES: Record<string, ModelPrice> = {
  "gemini:gemini-3.5-flash-lite": { inPerM: 0.3, outPerM: 2.5, batchFactor: 0.5 },
  "gemini:gemini-3.1-flash-lite": { inPerM: 0.25, outPerM: 1.5, batchFactor: 0.5 },
  "gemini:gemini-3.8-flash": { inPerM: 0.75, outPerM: 3.75, batchFactor: 0.5 },
  "openai:gpt-6-luna": { inPerM: 0.1, outPerM: 0.5, batchFactor: 1 },
};

const MOST_EXPENSIVE: Record<"gemini" | "openai", ModelPrice> = {
  gemini: PRICES["gemini:gemini-3.8-flash"],
  openai: PRICES["openai:gpt-6-luna"],
};

export function lookupPrice(
  provider: ProviderName | string,
  model: string,
  compat?: { inPerM: number; outPerM: number },
): { price: ModelPrice; warning: string | null } {
  if (provider === "mock") return { price: { inPerM: 0, outPerM: 0, batchFactor: 1 }, warning: null };
  if (provider === "openai_compat") {
    return {
      price: { inPerM: compat?.inPerM ?? 0, outPerM: compat?.outPerM ?? 0, batchFactor: 1 },
      warning: null,
    };
  }
  const known = PRICES[`${provider}:${model}`];
  if (known) return { price: known, warning: null };
  const expensive = provider === "openai" ? MOST_EXPENSIVE.openai : MOST_EXPENSIVE.gemini;
  return {
    price: expensive,
    warning: `Unknown ${provider} model "${model}". Spend uses the highest known ${provider} price.`,
  };
}

function scaled(perM: number): number {
  return Math.round(perM * 1_000_000);
}

/**
 * Micro-dollars. USD per 1M tokens cancels to `tokens * price`, rounded up.
 * A batch call multiplies by the model's batch factor before the rounding.
 */
export function costMicroUsd(inputTokens: number, outputTokens: number, price: ModelPrice, batch = false): number {
  const inputs = Math.max(0, inputTokens) * scaled(price.inPerM);
  const outputs = Math.max(0, outputTokens) * scaled(price.outPerM);
  const factor = batch ? Math.round(price.batchFactor * 1000) : 1000;
  const raw = (inputs + outputs) * factor;
  if (raw <= 0) return 0;
  return Math.ceil(raw / 1_000_000_000);
}

export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
