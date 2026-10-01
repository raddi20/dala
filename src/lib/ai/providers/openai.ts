import OpenAI from "openai";
import { toProviderJsonSchema } from "@/lib/ai/json-schema";
import { costMicroUsd, estimateTokensFromText, lookupPrice } from "@/lib/ai/prices";
import { AiError, type AIProvider, type GenerateRequest, type GenerateResult, type Usage } from "@/lib/ai/types";
import { asAiError, observeFetch, parseJsonObject, type HeaderSink } from "@/lib/ai/providers/errors";

function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function createOpenAIProvider(options: { apiKey: string; fetchImpl?: typeof fetch }): AIProvider {
  return {
    name: "openai",
    supportsImages() {
      return true;
    },
    async generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const sink: HeaderSink = { retryAfter: null };
      const client = new OpenAI({
        apiKey: options.apiKey,
        fetch: observeFetch(options.fetchImpl ?? fetch, sink),
        maxRetries: 0,
      });
      const started = Date.now();
      const content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "low" }> = [
        { type: "input_text", text: req.text },
      ];
      for (const image of req.images ?? []) {
        content.push({
          type: "input_image",
          image_url: `data:${image.mimeType};base64,${bytesToBase64(image.data)}`,
          detail: "low",
        });
      }
      try {
        const response = (await client.responses.create(
          {
            model: req.model,
            input: [
              { role: "system", content: req.system },
              { role: "user", content },
            ],
            text: {
              format: {
                type: "json_schema",
                name: req.schemaName,
                strict: true,
                schema: toProviderJsonSchema(req.schema),
              },
            },
            temperature: req.temperature ?? 0.2,
            max_output_tokens: req.maxOutputTokens,
            reasoning: { effort: "none" },
          },
          { signal: req.signal },
        )) as OpenAIResponse;
        const refusal = response.output?.some((item) => item.content?.some((part) => part.type === "refusal" || part.refusal));
        const text = response.output_text ?? "";
        const usage = openAIUsage(response.usage);
        if (refusal) throw new AiError("refused", "The model declined the request.", false, usage);
        return finishOpenAI(req, text, usage, started);
      } catch (error) {
        throw asAiError(error, sink.retryAfter, Date.now());
      }
    },
  };
}

function openAIUsage(usage: { input_tokens?: number; output_tokens?: number } | undefined): Usage {
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  return { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
}

export function finishOpenAI<T>(
  req: GenerateRequest<T>,
  text: string,
  usage: Usage,
  started: number,
  provider: "openai" | "openai_compat" = "openai",
  compatPrices?: { inPerM: number; outPerM: number },
): GenerateResult<T> {
  let json: unknown;
  try {
    json = parseJsonObject(text);
  } catch {
    throw new AiError("invalid_output", "The model did not return JSON.", false, fillUsage(usage, req, text));
  }
  const parsed = req.schema.safeParse(json);
  const bill = fillUsage(usage, req, text);
  if (!parsed.success) throw new AiError("invalid_output", "The model output did not match the schema.", false, bill);
  const price = lookupPrice(provider, req.model, compatPrices);
  return {
    data: parsed.data,
    usage: bill,
    costMicroUsd: costMicroUsd(bill.inputTokens, bill.outputTokens, price.price, req.feature === "seller_tips"),
    provider,
    model: req.model,
    latencyMs: Math.max(0, Date.now() - started),
  };
}

function fillUsage(usage: Usage, req: GenerateRequest<unknown>, text: string): Usage {
  if (!usage.estimated && usage.inputTokens + usage.outputTokens > 0) return usage;
  return {
    inputTokens: estimateTokensFromText(`${req.system}\n${req.text}`),
    outputTokens: estimateTokensFromText(text || " "),
    estimated: true,
  };
}
