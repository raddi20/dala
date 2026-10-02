import { z } from "zod";
import { visitorActorHash } from "@/lib/ai/actor";
import { checkFamilyHelper, familyHelperPrompt, type FamilyHelperResult } from "@/lib/ai/prompts/family-helper";
import { runAi } from "@/lib/ai/run";
import type { AiActor, RunResult } from "@/lib/ai/types";

export const familyDraftBody = z.object({
  text: z.string().trim().min(1).max(300),
  subjectName: z.string().trim().max(120).optional().default(""),
});

export type FamilyDraftResponse = FamilyHelperResult;

export type FamilyDraftResult =
  | { ok: true; fields: FamilyDraftResponse }
  | { ok: false; status: number; error: string };

export type FamilyRunner = (
  spec: typeof familyHelperPrompt,
  input: { text: string; subjectName: string; today: string },
  actor?: AiActor,
  deps?: { env?: NodeJS.ProcessEnv },
) => Promise<RunResult<FamilyHelperResult>>;

const UNAVAILABLE = "Not available right now. You can still fill the form yourself.";

export function nairobiToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Fills the family-order form. Does not open WhatsApp and does not store the buyer's sentence.
 */
export async function draftFamilyOrder(
  raw: unknown,
  deps: {
    now?: Date;
    actorHash?: string | null;
    env?: NodeJS.ProcessEnv;
    run?: FamilyRunner;
  } = {},
): Promise<FamilyDraftResult> {
  const parsed = familyDraftBody.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: true,
      fields: { item: "", recipientName: "", town: "", dateNeeded: "", payer: "", notes: "" },
    };
  }

  const now = deps.now ?? new Date();
  const today = nairobiToday(now);
  const actorHash = deps.actorHash ?? null;
  if (!actorHash) return { ok: false, status: 429, error: UNAVAILABLE };

  const run = deps.run ?? runAi;
  const result = await run(
    familyHelperPrompt,
    { text: parsed.data.text, subjectName: parsed.data.subjectName, today },
    { actorHash },
    deps.env ? { env: deps.env } : {},
  );
  if (!result.ok) {
    if (result.kind === "rate_capped") {
      return { ok: false, status: 429, error: "That's enough drafts for today. Fill the form yourself." };
    }
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  return {
    ok: true,
    fields: checkFamilyHelper(result.data, {
      text: parsed.data.text,
      subjectName: parsed.data.subjectName,
      today,
    }),
  };
}

export function actorFromRequestCookie(cookieHeader: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
  const match = cookieHeader?.match(/(?:^|; )rangach_visitor=([A-Za-z0-9_-]{16,80})/);
  if (!match?.[1]) return null;
  return visitorActorHash(match[1], env);
}
