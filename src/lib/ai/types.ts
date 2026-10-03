import type { ZodType } from "zod/v4";

export type AiFeature = "listing_writer" | "smart_search" | "family_helper" | "moderation" | "seller_tips";
export type ProviderName = "gemini" | "openai" | "openai_compat" | "mock";
export type ModelTier = "primary" | "fast";

export interface ImagePart {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: Uint8Array;
}

export interface GenerateRequest<T> {
  feature: AiFeature;
  model: string;
  system: string;
  text: string;
  images?: ImagePart[];
  schema: ZodType<T>;
  schemaName: string;
  maxOutputTokens: number;
  temperature?: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  estimated?: boolean;
}

export interface GenerateResult<T> {
  data: T;
  usage: Usage;
  costMicroUsd: number;
  provider: ProviderName;
  model: string;
  latencyMs: number;
}

export type AiErrorKind =
  | "timeout"
  | "rate_limited"
  | "server"
  | "network"
  | "auth"
  | "bad_request"
  | "schema"
  | "model_not_found"
  | "refused"
  | "invalid_output"
  | "disabled"
  | "over_budget"
  | "rate_capped";

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
    public retryable = false,
    public usage?: Usage,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AIProvider {
  readonly name: ProviderName;
  supportsImages(model: string): boolean;
  generateStructured<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

export type AiActor = {
  userId?: string;
  actorHash?: string;
};

export type RunSuccess<T> = {
  ok: true;
  data: T;
  provider: ProviderName;
  model: string;
  costMicroUsd: number;
  latencyMs: number;
};

export type RunFailure = {
  ok: false;
  kind: AiErrorKind;
};

export type RunResult<T> = RunSuccess<T> | RunFailure;
