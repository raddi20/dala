import OpenAI from "openai";
import { toProviderJsonSchema } from "@/lib/ai/json-schema";
import { AiError, type AIProvider, type GenerateRequest, type GenerateResult, type Usage } from "@/lib/ai/types";
import { asAiError, observeFetch, type HeaderSink } from "@/lib/ai/providers/errors";
import { finishOpenAI } from "@/lib/ai/providers/openai";

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export function createOpenAICompatibleProvider(options: {
  apiKey: string;
  baseURL: string;
  vision: boolean;
  jsonMode: "json_schema" | "json_object";
  priceInPerM: number;
  priceOutPerM: number;
  fetchImpl?: typeof fetch;
}): AIProvider {
  return {
    name: "openai_compat",
    supportsImages() {
      return options.vision;
    },
    async generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const sink: HeaderSink = { retryAfter: null };
      const client = new OpenAI({
        apiKey: options.apiKey || "local",
        baseURL: options.baseURL,
        fetch: observeFetch(options.fetchImpl ?? fetch, sink),
        maxRetries: 0,
      });
      const started = Date.now();
      const schema = toProviderJsonSchema(req.schema);
      const system =
        options.jsonMode === "json_object"
          ? `${req.system}\n\nReturn JSON only, matching this schema:\n${JSON.stringify(schema)}`
          : req.system;
      const images = options.vision ? (req.images ?? []) : [];
      const userContent = messageContent(req.text, images);
      const responseFormat =
        options.jsonMode === "json_object"
          ? { type: "json_object" as const }
          : {
              type: "json_schema" as const,
              json_schema: { name: req.schemaName, schema, strict: true },
            };
      try {
        const response = (await client.chat.completions.create(
          {
            model: req.model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userContent },
            ],
            response_format: responseFormat,
            temperature: req.temperature ?? 0.2,
            max_tokens: req.maxOutputTokens,
          },
          { signal: req.signal },
        )) as ChatResponse;
        const message = response.choices?.[0]?.message;
        if (message?.refusal) {
          throw new AiError("refused", "The model declined the request.", false, chatUsage(response.usage));
        }
        const text = message?.content ?? "";
        return finishOpenAI(req, text, chatUsage(response.usage), started, "openai_compat", {
          inPerM: options.priceInPerM,
          outPerM: options.priceOutPerM,
        });
      } catch (error) {
        throw asAiError(error, sink.retryAfter, Date.now());
      }
    },
  };
}

function messageContent(
  text: string,
  images: NonNullable<GenerateRequest<unknown>["images"]>,
): string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  if (images.length === 0) return text;
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text },
  ];
  for (const image of images) {
    let binary = "";
    for (const byte of image.data) binary += String.fromCharCode(byte);
    parts.push({ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${btoa(binary)}` } });
  }
  return parts;
}

function chatUsage(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): Usage {
  if (!usage || (usage.prompt_tokens === undefined && usage.completion_tokens === undefined)) {
    return { inputTokens: 0, outputTokens: 0, estimated: true };
  }
  return { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 };
}
