import { readAiConfig, type AiConfig } from "@/lib/ai/config";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import type { AIProvider, AiFeature, ModelTier, ProviderName } from "@/lib/ai/types";

export function tierFor(feature: AiFeature): ModelTier {
  if (feature === "smart_search" || feature === "family_helper") return "fast";
  return "primary";
}

export function resolveModel(feature: AiFeature, config: AiConfig, fallback = false): string {
  if (fallback && config.fallback) return config.fallback.model;
  const override = config.modelOverrides[feature];
  if (override) return override;
  return tierFor(feature) === "fast" ? config.modelFast : config.modelPrimary;
}

export function getProvider(name: ProviderName, config: AiConfig, fetchImpl?: typeof fetch): AIProvider {
  if (name === "gemini") return createGeminiProvider({ apiKey: config.geminiApiKey, fetchImpl });
  if (name === "openai") return createOpenAIProvider({ apiKey: config.openaiApiKey, fetchImpl });
  if (name === "openai_compat") {
    return createOpenAICompatibleProvider({
      apiKey: config.compatApiKey,
      baseURL: config.compatBaseUrl,
      vision: config.compatVision,
      jsonMode: config.compatJsonMode,
      priceInPerM: config.priceInPerM,
      priceOutPerM: config.priceOutPerM,
      fetchImpl,
    });
  }
  return createMockProvider(config.mockMode);
}

export function providerFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch): AIProvider {
  const config = readAiConfig(env);
  return getProvider(config.provider, config, fetchImpl);
}
