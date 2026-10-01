import type { AiFeature, ProviderName } from "@/lib/ai/types";

export const AI_FEATURES = ["listing_writer", "smart_search", "family_helper", "moderation", "seller_tips"] as const;

export const FEATURE_ENV: Record<AiFeature, string> = {
  listing_writer: "AI_LISTING_WRITER",
  smart_search: "AI_SMART_SEARCH",
  family_helper: "AI_FAMILY_HELPER",
  moderation: "AI_MODERATION",
  seller_tips: "AI_SELLER_TIPS",
};

export const FEATURE_MODEL_ENV: Record<AiFeature, string> = {
  listing_writer: "AI_MODEL_LISTING_WRITER",
  smart_search: "AI_MODEL_SMART_SEARCH",
  family_helper: "AI_MODEL_FAMILY_HELPER",
  moderation: "AI_MODEL_MODERATION",
  seller_tips: "AI_MODEL_SELLER_TIPS",
};

export type MockMode = "ok" | "invalid" | "timeout" | "error" | "slow";

export type AiConfig = {
  disabled: boolean;
  disabledReason: string | null;
  warnings: string[];
  provider: ProviderName;
  geminiApiKey: string;
  openaiApiKey: string;
  compatBaseUrl: string;
  compatApiKey: string;
  compatVision: boolean;
  compatJsonMode: "json_schema" | "json_object";
  priceInPerM: number;
  priceOutPerM: number;
  modelPrimary: string;
  modelFast: string;
  modelOverrides: Partial<Record<AiFeature, string>>;
  fallback: { provider: ProviderName; model: string } | null;
  timeoutMs: number;
  /** Null means the feature default: 1 interactive, 2 batch. */
  maxRetries: number | null;
  monthlyBudgetUsd: number;
  mockMode: MockMode;
};

const PROVIDERS = new Set<string>(["gemini", "openai", "openai_compat", "mock"]);
const MOCK_MODES = new Set<string>(["ok", "invalid", "timeout", "error", "slow"]);

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Preview may use mock. Production, including a local production build, may not. */
export function isProductionRuntime(env: NodeJS.ProcessEnv): boolean {
  if (env.VERCEL_ENV === "preview") return false;
  if (env.VERCEL_ENV === "production") return true;
  return env.NODE_ENV === "production";
}

function nonNegativeInt(value: string, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

function priceNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function defaultModels(provider: ProviderName): { primary: string; fast: string } {
  if (provider === "openai") return { primary: "gpt-6-luna", fast: "gpt-6-luna" };
  if (provider === "mock") return { primary: "mock", fast: "mock" };
  if (provider === "openai_compat") return { primary: "", fast: "" };
  return { primary: "gemini-3.5-flash-lite", fast: "gemini-3.1-flash-lite" };
}

function providerHasKey(name: ProviderName, envKeys: { gemini: string; openai: string; compatReady: boolean }): boolean {
  if (name === "mock") return true;
  if (name === "gemini") return Boolean(envKeys.gemini);
  if (name === "openai") return Boolean(envKeys.openai);
  return envKeys.compatReady;
}

/**
 * Reads AI env vars. Never throws. A bad or missing setting disables AI.
 */
export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const warnings: string[] = [];
  const production = isProductionRuntime(env);
  const requested = clean(env.AI_PROVIDER);
  const geminiApiKey = clean(env.GEMINI_API_KEY);
  const openaiApiKey = clean(env.OPENAI_API_KEY);
  const compatBaseUrl = clean(env.AI_BASE_URL);
  const compatApiKey = clean(env.AI_API_KEY);
  const priceIn = priceNumber(clean(env.AI_PRICE_IN_PER_M));
  const priceOut = priceNumber(clean(env.AI_PRICE_OUT_PER_M));
  const compatReady = Boolean(compatBaseUrl) && priceIn !== null && priceOut !== null;

  let provider: ProviderName = "gemini";
  let disabled = false;
  let disabledReason: string | null = null;

  const disable = (reason: string) => {
    disabled = true;
    disabledReason = reason;
  };

  if (requested && !PROVIDERS.has(requested)) {
    disable(`AI_PROVIDER "${requested}" is not a known provider.`);
  } else if (requested) {
    provider = requested as ProviderName;
  } else if (env.NODE_ENV === "test" || (!production && !geminiApiKey && !openaiApiKey)) {
    provider = "mock";
  } else if (geminiApiKey) {
    provider = "gemini";
  } else if (openaiApiKey) {
    provider = "openai";
  } else {
    disable("No AI provider key is set.");
  }

  if (provider === "mock" && production) {
    disable("AI_PROVIDER=mock is refused in production.");
  }

  if (!disabled && provider === "gemini" && !geminiApiKey) disable("GEMINI_API_KEY is missing.");
  if (!disabled && provider === "openai" && !openaiApiKey) disable("OPENAI_API_KEY is missing.");
  if (!disabled && provider === "openai_compat") {
    if (!compatBaseUrl) disable("AI_BASE_URL is missing for openai_compat.");
    else if (priceIn === null || priceOut === null) {
      disable("AI_PRICE_IN_PER_M and AI_PRICE_OUT_PER_M are required for openai_compat.");
    } else if (!clean(env.AI_MODEL_PRIMARY) || !clean(env.AI_MODEL_FAST)) {
      disable("AI_MODEL_PRIMARY and AI_MODEL_FAST are required for openai_compat.");
    }
  }

  const defaults = defaultModels(provider);
  const modelPrimary = clean(env.AI_MODEL_PRIMARY) || defaults.primary;
  const modelFast = clean(env.AI_MODEL_FAST) || defaults.fast;
  const modelOverrides: Partial<Record<AiFeature, string>> = {};
  for (const feature of AI_FEATURES) {
    const value = clean(env[FEATURE_MODEL_ENV[feature]]);
    if (value) modelOverrides[feature] = value;
  }

  let fallback: AiConfig["fallback"] = null;
  const fallbackName = clean(env.AI_FALLBACK_PROVIDER);
  const fallbackModel = clean(env.AI_FALLBACK_MODEL);
  if (fallbackName || fallbackModel) {
    if (!PROVIDERS.has(fallbackName)) {
      warnings.push("AI_FALLBACK_PROVIDER is not usable. Calls stop at the non-AI fallback.");
    } else if (!fallbackModel) {
      warnings.push("AI_FALLBACK_MODEL is empty. Calls stop at the non-AI fallback.");
    } else if (fallbackName === provider) {
      warnings.push("AI_FALLBACK_PROVIDER matches the primary provider. Calls stop at the non-AI fallback.");
    } else if (!providerHasKey(fallbackName as ProviderName, { gemini: geminiApiKey, openai: openaiApiKey, compatReady })) {
      warnings.push("The fallback provider has no key. Calls stop at the non-AI fallback.");
    } else if (fallbackName === "mock" && production) {
      warnings.push("A mock fallback is refused in production.");
    } else {
      fallback = { provider: fallbackName as ProviderName, model: fallbackModel };
    }
  }

  const mockRaw = clean(env.AI_MOCK_MODE) || "ok";
  const mockMode = (MOCK_MODES.has(mockRaw) ? mockRaw : "ok") as MockMode;
  const budgetRaw = clean(env.AI_MONTHLY_BUDGET_USD);
  const budgetNumber = budgetRaw ? Number(budgetRaw) : 0;
  const monthlyBudgetUsd = Number.isFinite(budgetNumber) && budgetNumber > 0 ? budgetNumber : 0;
  const timeoutRaw = nonNegativeInt(clean(env.AI_TIMEOUT_MS), 8000);
  const retriesRaw = clean(env.AI_MAX_RETRIES);

  return {
    disabled,
    disabledReason,
    warnings,
    provider,
    geminiApiKey,
    openaiApiKey,
    compatBaseUrl,
    compatApiKey,
    compatVision: clean(env.AI_COMPAT_VISION) === "1",
    compatJsonMode: clean(env.AI_COMPAT_JSON_MODE) === "json_object" ? "json_object" : "json_schema",
    priceInPerM: priceIn ?? 0,
    priceOutPerM: priceOut ?? 0,
    modelPrimary,
    modelFast,
    modelOverrides,
    fallback,
    timeoutMs: timeoutRaw > 0 ? timeoutRaw : 8000,
    maxRetries: retriesRaw ? nonNegativeInt(retriesRaw, 1) : null,
    monthlyBudgetUsd,
    mockMode,
  };
}
