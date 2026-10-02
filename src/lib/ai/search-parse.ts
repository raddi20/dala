import { createHash } from "node:crypto";
import { isCategory } from "@/lib/categories";
import { isCityName, isListingType, regionLabel, typeLabel } from "@/lib/constants";
import { parseNlQuery, type NlParse } from "@/lib/nl-query";
import { occasionDefinition } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { runAi } from "@/lib/ai/run";
import { searchParseSchema, smartSearchPrompt, type SearchParse } from "@/lib/ai/prompts/smart-search";
import type { AiActor, RunResult } from "@/lib/ai/types";

export const SEARCH_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_CONFIDENCE = 0.5;

const OCCASION_WORDS = [
  "ayie",
  "homecoming",
  "homecomings",
  "funeral",
  "funerals",
  "christmas",
  "dowry",
  "wedding",
  "weddings",
];

export type SearchInterpretation = NlParse & {
  smart: boolean;
  occasion: string;
};

export type SearchCache = {
  get(queryKey: string, now: Date): Promise<SearchParse | null>;
  put(queryKey: string, value: SearchParse, expiresAt: Date): Promise<void>;
};

export type SearchRunner = (
  spec: typeof smartSearchPrompt,
  input: { query: string },
  actor?: AiActor,
  deps?: { env?: NodeJS.ProcessEnv },
) => Promise<RunResult<SearchParse>>;

export function normalizeSearchQuery(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

/** Cache id. A hash, not the raw query, so a long search cannot overflow the primary key. */
export function searchQueryHash(queryNorm: string): string {
  return createHash("sha256").update(`${smartSearchPrompt.version}\n${queryNorm}`).digest("hex");
}

export function hasOccasionWord(input: string): boolean {
  const text = input.toLowerCase();
  return OCCASION_WORDS.some((word) => new RegExp(`(?:^|[^a-z0-9])${word}(?=[^a-z0-9]|$)`, "i").test(text));
}

/** Letters outside Latin, so a Dholuo or Swahili sentence in Latin letters is not enough on its own. */
export function hasNonLatin(input: string): boolean {
  return /[^\u0000-\u024F]/.test(input);
}

/**
 * Rules run first. The model is asked only for a sentence of 3+ words that the rules
 * could not place, or that mentions an occasion or a non-Latin script.
 */
export function shouldAskSmartSearch(input: string, rules: NlParse): boolean {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  if (hasOccasionWord(input) || hasNonLatin(input)) return true;
  if (!rules.category || !rules.city) return true;
  return false;
}

function summaryFor(parsed: Omit<SearchInterpretation, "summary" | "smart">): string {
  const parts: string[] = [];
  if (parsed.city) parts.push(parsed.city);
  if (parsed.region) parts.push(regionLabel(parsed.region));
  if (parsed.category) parts.push(parsed.category);
  if (parsed.type) parts.push(typeLabel(parsed.type));
  if (parsed.verified) parts.push("Verified only");
  if (parsed.occasion) {
    const occasion = occasionDefinition(parsed.occasion);
    if (occasion) parts.push(occasion.title);
  }
  if (parsed.q) parts.push(`Text "${parsed.q}"`);
  return parts.length > 0 ? parts.join(" · ") : "No filters detected. Searching the words you typed.";
}

function fromRules(rules: NlParse): SearchInterpretation {
  return { ...rules, smart: false, occasion: "" };
}

export function applySearchParse(rules: NlParse, ai: SearchParse): SearchInterpretation {
  if (ai.confidence < MIN_CONFIDENCE) return fromRules(rules);
  const city = ai.city && isCityName(ai.city) ? ai.city : rules.city;
  const region = ai.region === "homeland" || ai.region === "diaspora" ? ai.region : rules.region;
  const category = ai.category && isCategory(ai.category) ? ai.category : rules.category;
  const type = ai.type && isListingType(ai.type) ? ai.type : rules.type;
  const occasion = ai.occasion && occasionDefinition(ai.occasion) ? ai.occasion : "";
  let q = ai.keywords.trim().slice(0, 60);
  if (ai.city && !isCityName(ai.city) && !q.toLowerCase().includes(ai.city.toLowerCase())) {
    q = `${q} ${ai.city}`.trim().slice(0, 60);
  }
  if (!q) q = rules.q;
  const next = {
    city,
    region,
    category,
    type,
    verified: rules.verified,
    q,
    occasion,
  };
  return { ...next, smart: true, summary: summaryFor(next) };
}

export function prismaSearchCache(): SearchCache {
  return {
    async get(queryKey, now) {
      try {
        const row = await prisma.aiSearchCache.findUnique({ where: { queryKey } });
        if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
        const parsed = searchParseSchema.safeParse(JSON.parse(row.resultJson));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    async put(queryKey, value, expiresAt) {
      try {
        const resultJson = JSON.stringify(value);
        await prisma.aiSearchCache.upsert({
          where: { queryKey },
          create: { queryKey, resultJson, expiresAt },
          update: { resultJson, expiresAt },
        });
      } catch {
        // A missing table or a full disk must not break search.
      }
    },
  };
}

export async function interpretSearch(
  input: string,
  deps: {
    now?: Date;
    actorHash?: string;
    run?: SearchRunner;
    cache?: SearchCache;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<SearchInterpretation> {
  const rules = parseNlQuery(input);
  try {
    const queryNorm = normalizeSearchQuery(input);
    if (!queryNorm || !shouldAskSmartSearch(input, rules)) return fromRules(rules);

    const now = deps.now ?? new Date();
    const cache = deps.cache ?? prismaSearchCache();
    const queryKey = searchQueryHash(queryNorm);
    const cached = await cache.get(queryKey, now);
    if (cached) return applySearchParse(rules, cached);

    const run = deps.run ?? runAi;
    const result = await run(
      smartSearchPrompt,
      { query: input.trim().slice(0, 200) },
      { actorHash: deps.actorHash },
      deps.env ? { env: deps.env } : {},
    );
    if (!result.ok) return fromRules(rules);
    await cache.put(queryKey, result.data, new Date(now.getTime() + SEARCH_CACHE_MS));
    return applySearchParse(rules, result.data);
  } catch {
    return fromRules(rules);
  }
}
