import type { Prisma } from "@prisma/client";

type Env = Record<string, string | undefined>;

/** Postgres is case-sensitive for `contains`. SQLite LIKE is not, for ASCII. */
export function usesPostgres(env: Env = process.env): boolean {
  return /^postgres(ql)?:/i.test(env.DATABASE_URL ?? "");
}

export type TextContains = Prisma.StringFilter & { mode?: "insensitive" };

/**
 * The committed Prisma schema is SQLite, so the generated client has no `mode`.
 * Production switches the provider to Postgres. Only then do we ask for insensitive match.
 * Callers pass the result into a Prisma where. Extra `mode` is ignored by the SQLite client
 * because we only set it for Postgres.
 */
export function containsFilter(term: string, env: Env = process.env): TextContains {
  if (usesPostgres(env)) return { contains: term, mode: "insensitive" };
  return { contains: term };
}

/** Cheap plural fold: shops → shop, cities → city. Leaves short words alone. */
export function simpleStem(word: string): string {
  const value = word.toLowerCase();
  if (value.length <= 4) return value;
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/.test(value)) return value.slice(0, -2);
  if (value.endsWith("es") && value.length > 5) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

/** The typed phrase, plus a lower-case copy, a stem, and a simple plural. Phrases stay whole. */
export function searchTerms(raw: string): string[] {
  const term = raw.trim();
  if (!term) return [];
  if (/\s/.test(term)) return [term];
  const lower = term.toLowerCase();
  const terms = new Set<string>([term]);
  if (lower !== term) terms.add(lower);
  const stem = simpleStem(lower);
  if (stem.length >= 3 && stem !== lower) terms.add(stem);
  if (lower.length >= 3 && !/[sS]$/.test(term)) terms.add(`${lower}s`);
  return [...terms].slice(0, 4);
}

export function matchTerms(input: { q?: string; words?: string[] }): string[] {
  const q = input.q?.trim() ?? "";
  if (q) return searchTerms(q);
  const words = (input.words ?? [])
    .map((word) => word.trim())
    .filter((word) => word.length > 2)
    .slice(0, 6);
  const terms = new Set<string>();
  for (const word of words) {
    for (const term of searchTerms(word)) terms.add(term);
  }
  return [...terms].slice(0, 12);
}
