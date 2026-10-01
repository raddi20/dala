import type { ZodType } from "zod/v4";
import type { AiFeature, ImagePart, ModelTier } from "@/lib/ai/types";

export interface PromptSpec<I, O> {
  feature: AiFeature;
  version: string;
  tier: ModelTier;
  system: string;
  render(input: I): { text: string; images?: ImagePart[] };
  schema: ZodType<O>;
  schemaName: string;
  maxOutputTokens: number;
  temperature?: number;
  postCheck?(out: O, input: I): O | null;
}
