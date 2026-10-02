export { familyHelperPrompt, familyHelperSchema } from "@/lib/ai/prompts/family-helper";
export { listingWriterPrompt, listingSuggestionSchema } from "@/lib/ai/prompts/listing-writer";
export { moderationPrompt, moderationSchema } from "@/lib/ai/prompts/moderation";
export { searchParseSchema, smartSearchPrompt } from "@/lib/ai/prompts/smart-search";
export { sellerTipsPrompt, sellerTipsSchema } from "@/lib/ai/prompts/seller-tips";

import { familyHelperPrompt } from "@/lib/ai/prompts/family-helper";
import { listingWriterPrompt } from "@/lib/ai/prompts/listing-writer";
import { moderationPrompt } from "@/lib/ai/prompts/moderation";
import { smartSearchPrompt } from "@/lib/ai/prompts/smart-search";
import { sellerTipsPrompt } from "@/lib/ai/prompts/seller-tips";
import type { PromptSpec } from "@/lib/ai/prompts/types";

export const ALL_PROMPTS: PromptSpec<unknown, unknown>[] = [
  listingWriterPrompt as PromptSpec<unknown, unknown>,
  smartSearchPrompt as PromptSpec<unknown, unknown>,
  familyHelperPrompt as PromptSpec<unknown, unknown>,
  moderationPrompt as PromptSpec<unknown, unknown>,
  sellerTipsPrompt as PromptSpec<unknown, unknown>,
];
