import { FEATURE_ENV } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";
import type { AiFeature } from "@/lib/ai/types";

export type FlagLookup = (key: string) => Promise<boolean | null>;

/**
 * True only when the env flag is exactly "1" and the database has not switched it off.
 * A database row can disable a feature. It cannot enable one whose env flag is unset.
 */
export async function isAiFeatureOn(
  feature: AiFeature,
  deps?: { env?: NodeJS.ProcessEnv; lookup?: FlagLookup },
): Promise<boolean> {
  const env = deps?.env ?? process.env;
  const key = FEATURE_ENV[feature];
  if (env[key] !== "1") return false;
  const lookup = deps?.lookup ?? defaultLookup;
  try {
    const enabled = await lookup(key);
    return enabled !== false;
  } catch {
    return false;
  }
}

async function defaultLookup(key: string): Promise<boolean | null> {
  const row = await prisma.aiFlag.findUnique({ where: { key }, select: { enabled: true } });
  return row ? row.enabled : null;
}
