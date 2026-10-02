import { AiError, type AiErrorKind, type Usage } from "@/lib/ai/types";

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "AbortError" || name === "TimeoutError" || message.toLowerCase().includes("aborted");
}

export function kindFromStatus(status: number): { kind: AiErrorKind; retryable: boolean } {
  if (status === 429) return { kind: "rate_limited", retryable: true };
  if (status === 401 || status === 403) return { kind: "auth", retryable: false };
  if (status === 400 || status === 404) return { kind: "bad_request", retryable: false };
  if (status >= 500) return { kind: "server", retryable: true };
  return { kind: "server", retryable: true };
}

export function retryAfterMs(header: string | null, now: number): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return undefined;
}

export function httpError(status: number, retryAfter: string | null, now: number): AiError {
  const mapped = kindFromStatus(status);
  return new AiError(mapped.kind, `HTTP ${status}`, mapped.retryable, undefined, retryAfterMs(retryAfter, now));
}

export function asAiError(error: unknown, retryAfter: string | null, now: number): AiError {
  if (error instanceof AiError) return error;
  if (isAbortError(error)) return new AiError("timeout", "The model timed out.", true);
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : NaN;
  if (Number.isInteger(status) && status >= 400) return httpError(status, retryAfter, now);
  return new AiError("network", "The model could not be reached.", true);
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function usageOrEstimate(usage: Usage | undefined, requestText: string, responseText: string): Usage {
  if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0) && !usage.estimated) return usage;
  if (usage && !usage.estimated && usage.inputTokens + usage.outputTokens > 0) return usage;
  return {
    inputTokens: Math.ceil(requestText.length / 4),
    outputTokens: Math.ceil(responseText.length / 4),
    estimated: true,
  };
}

export type HeaderSink = { retryAfter: string | null };

export function observeFetch(base: typeof fetch, sink: HeaderSink): typeof fetch {
  return async (input, init) => {
    const response = await base(input, init);
    sink.retryAfter = response.headers.get("retry-after");
    return response;
  };
}
