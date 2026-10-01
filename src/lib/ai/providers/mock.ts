import { lookupPrice, costMicroUsd } from "@/lib/ai/prices";
import { AiError, type AIProvider, type GenerateRequest, type GenerateResult, type ProviderName } from "@/lib/ai/types";
import { invalidFixture, MOCK_USAGE, mockFixture } from "@/lib/ai/providers/mock-fixtures";
import type { MockMode } from "@/lib/ai/config";

export function createMockProvider(mode: MockMode = "ok"): AIProvider {
  return {
    name: "mock",
    supportsImages() {
      return true;
    },
    async generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      if (mode === "timeout" || mode === "slow") {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (mode === "timeout") reject(new AiError("timeout", "Mock timed out.", true));
            else resolve();
          }, mode === "slow" ? 30_000 : 60_000);
          req.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new AiError("timeout", "Mock aborted.", true));
          });
        });
      }
      if (mode === "error") throw new AiError("server", "Mock error.", true);
      const raw = mode === "invalid" ? invalidFixture() : mockFixture(req.feature);
      const parsed = req.schema.safeParse(raw);
      const usage = { ...MOCK_USAGE };
      if (!parsed.success) throw new AiError("invalid_output", "Mock output failed the schema.", false, usage);
      const price = lookupPrice("mock", req.model).price;
      return {
        data: parsed.data,
        usage,
        costMicroUsd: costMicroUsd(usage.inputTokens, usage.outputTokens, price),
        provider: "mock" satisfies ProviderName,
        model: req.model,
        latencyMs: 1,
      };
    },
  };
}
