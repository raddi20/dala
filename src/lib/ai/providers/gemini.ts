import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { costMicroUsd, estimateTokensFromText, lookupPrice } from "@/lib/ai/prices";
import { AiError, type AIProvider, type GenerateRequest, type GenerateResult, type Usage } from "@/lib/ai/types";
import { asAiError, observeFetch, parseJsonObject, type HeaderSink } from "@/lib/ai/providers/errors";
import { toProviderJsonSchema } from "@/lib/ai/json-schema";

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createGeminiProvider(options: { apiKey: string; fetchImpl?: typeof fetch }): AIProvider {
  return {
    name: "gemini",
    supportsImages() {
      return true;
    },
    async generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const sink: HeaderSink = { retryAfter: null };
      const ai = new GoogleGenAI({
        apiKey: options.apiKey,
        httpOptions: {
          fetch: observeFetch(options.fetchImpl ?? fetch, sink),
          retryOptions: { attempts: 1 },
        },
      });
      const started = Date.now();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: req.text }];
      for (const image of req.images ?? []) {
        parts.push({ inlineData: { mimeType: image.mimeType, data: bytesToBase64(image.data) } });
      }
      try {
        const response = await ai.models.generateContent({
          model: req.model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: req.system,
            temperature: req.temperature ?? 0.2,
            maxOutputTokens: req.maxOutputTokens,
            responseMimeType: "application/json",
            responseJsonSchema: toProviderJsonSchema(req.schema),
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            abortSignal: req.signal,
          },
        });
        const usage = geminiUsage(response.usageMetadata);
        const blocked = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason === "SAFETY";
        if (blocked && !response.text) {
          throw new AiError("refused", "The model declined the request.", false, usage);
        }
        const text = response.text ?? "";
        return finish(req, text, usage, started);
      } catch (error) {
        throw asAiError(error, sink.retryAfter, Date.now());
      }
    },
  };
}

function geminiUsage(meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number } | undefined): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
    cachedInputTokens: meta?.cachedContentTokenCount,
  };
}

function finish<T>(req: GenerateRequest<T>, text: string, usage: Usage, started: number): GenerateResult<T> {
  let json: unknown;
  try {
    json = parseJsonObject(text);
  } catch {
    throw new AiError("invalid_output", "The model did not return JSON.", false, usageOrEmpty(usage, req, text));
  }
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) {
    throw new AiError("invalid_output", "The model output did not match the schema.", false, usageOrEmpty(usage, req, text));
  }
  const bill = usage.inputTokens + usage.outputTokens > 0 ? usage : usageOrEmpty(usage, req, text);
  const price = lookupPrice("gemini", req.model);
  return {
    data: parsed.data,
    usage: bill,
    costMicroUsd: costMicroUsd(bill.inputTokens, bill.outputTokens, price.price, req.feature === "seller_tips"),
    provider: "gemini",
    model: req.model,
    latencyMs: Date.now() - started,
  };
}

function usageOrEmpty(usage: Usage, req: GenerateRequest<unknown>, text: string): Usage {
  if (usage.inputTokens + usage.outputTokens > 0) return usage;
  return {
    inputTokens: estimateTokensFromText(`${req.system}\n${req.text}`),
    outputTokens: estimateTokensFromText(text || " "),
    estimated: true,
  };
}
