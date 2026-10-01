import type { AiFeature } from "@/lib/ai/types";
import { costMicroUsd, type ModelPrice } from "@/lib/ai/prices";

export type BudgetTier = "ok" | "public_off" | "all_off";

export const PUBLIC_AI_FEATURES: readonly AiFeature[] = ["smart_search", "family_helper"];

export function budgetCapMicro(budgetUsd: number): number {
  if (!(budgetUsd > 0)) return 0;
  return Math.round(budgetUsd * 1_000_000);
}

/** 80% turns off public features. 100%, or a budget of 0, turns off every AI feature. */
export function budgetTier(spentMicroUsd: number, budgetUsd: number): BudgetTier {
  const cap = budgetCapMicro(budgetUsd);
  if (cap <= 0) return "all_off";
  if (spentMicroUsd >= cap) return "all_off";
  if (spentMicroUsd >= cap * 0.8) return "public_off";
  return "ok";
}

export function featureBlockedByBudget(feature: AiFeature, tier: BudgetTier): boolean {
  if (tier === "all_off") return true;
  if (tier === "public_off" && PUBLIC_AI_FEATURES.includes(feature)) return true;
  return false;
}

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function worstCaseMicro(inputTokens: number, maxOutputTokens: number, price: ModelPrice, batch: boolean): number {
  return costMicroUsd(inputTokens, maxOutputTokens, price, batch);
}

export function wouldCrossBudget(spentMicroUsd: number, estimateMicroUsd: number, budgetUsd: number): boolean {
  const cap = budgetCapMicro(budgetUsd);
  if (cap <= 0) return true;
  return spentMicroUsd + estimateMicroUsd >= cap;
}
