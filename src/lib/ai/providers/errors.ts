import { AiError, type AiErrorKind, type Usage } from "@/lib/ai/types";

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "AbortError" || name === "TimeoutError" || message.toLowerCase().includes("aborted");
}

export function kindFromStatus(status: number, code = "", text = ""): { kind: AiErrorKind; retryable: boolean } {
  if (status === 429) return { kind: "rate_limited", retryable: true };
  if (status === 401 || status === 403) return { kind: "auth", retryable: false };
  if (isModelNotFound(status, code, text)) return { kind: "model_not_found", retryable: false };
  if (status >= 400 && status < 500) return { kind: "bad_request", retryable: false };
  if (status >= 500) return { kind: "server", retryable: true };
  return { kind: "server", retryable: true };
}

function isModelNotFound(status: number, code: string, text: string): boolean {
  if (status === 404 || code === "NOT_FOUND") return true;
  if (status < 400 || status >= 500) return false;
  return /not found|unknown model|is not supported|invalid model/i.test(text);
}

/** Provider status plus a short message. Keys are removed. The prompt is not added. */
export function sanitizeProviderDetail(status: number | undefined, code: string, text: string): string {
  let body = text.replace(/\s+/g, " ").trim();
  body = body.replace(/AIza[0-9A-Za-z_-]{8,}/g, "[key]");
  body = body.replace(/Bearer\s+\S+/gi, "Bearer [key]");
  body = body.replace(/(api[_-]?key|token|authorization|secret)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1$2[key]");
  const prefix = [status ? `HTTP ${status}` : "", code].filter(Boolean).join(" ");
  const combined = prefix && body ? `${prefix}: ${body}` : prefix || body || "The model failed.";
  return combined.slice(0, 300);
}

export function readProviderError(raw: string): { httpStatus?: number; code: string; text: string } {
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: unknown; status?: unknown; message?: unknown } };
    const err = parsed.error;
    if (err && typeof err === "object") {
      const httpStatus = typeof err.code === "number" ? err.code : undefined;
      const code = typeof err.status === "string" ? err.status : "";
      const text = typeof err.message === "string" ? err.message : raw;
      return { httpStatus, code, text };
    }
  } catch {
    // Plain text from the SDK.
  }
  return { code: "", text: raw };
}

export function retryAfterMs(header: string | null, now: number): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return undefined;
}

export function httpError(status: number, retryAfter: string | null, now: number, raw = ""): AiError {
  const parsed = readProviderError(raw);
  const mapped = kindFromStatus(status, parsed.code, parsed.text);
  const detail = sanitizeProviderDetail(status, parsed.code, parsed.text || `HTTP ${status}`);
  return new AiError(mapped.kind, detail, mapped.retryable, undefined, retryAfterMs(retryAfter, now));
}

export function asAiError(error: unknown, retryAfter: string | null, now: number): AiError {
  if (error instanceof AiError) return error;
  if (isAbortError(error)) return new AiError("timeout", "The model timed out.", true);
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : NaN;
  const raw = error instanceof Error ? error.message : "";
  if (Number.isInteger(status) && status >= 400) return httpError(status, retryAfter, now, raw);
  const detail = sanitizeProviderDetail(undefined, "", raw || "The model could not be reached.");
  return new AiError("network", detail, true);
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
