import { z } from "zod/v4";
import { readAiConfig } from "@/lib/ai/config";
import { resolveModel } from "@/lib/ai/registry";
import { runAi } from "@/lib/ai/run";
import type { PromptSpec } from "@/lib/ai/prompts/types";
import type { AiErrorKind } from "@/lib/ai/types";
import { prismaUsageStore, type UsageStore } from "@/lib/ai/usage";

const probeSchema = z.object({ ok: z.literal(true) });

const probePrompt: PromptSpec<{ query: string }, { ok: true }> = {
  feature: "smart_search",
  version: "gemini_probe@1",
  tier: "fast",
  system: "Reply with the JSON object only.",
  schema: probeSchema,
  schemaName: "probe",
  maxOutputTokens: 32,
  render() {
    return { text: "Return ok true." };
  },
};

function plain(kind: AiErrorKind): string {
  if (kind === "disabled") return "AI is off, or the provider config is disabled. No call was sent.";
  if (kind === "over_budget") return "Monthly spend is at the cap. No call was sent.";
  if (kind === "rate_capped") return "The rate limit stopped this call before it was sent.";
  if (kind === "timeout") return "The model timed out.";
  if (kind === "model_not_found") return "The model id was not found.";
  return "The call failed.";
}

/** One short fast-model call for an admin. It uses the same path as smart search and counts toward the cap. */
export async function probeGeminiConnection(
  actor: { userId: string },
  deps?: { store?: UsageStore },
): Promise<{ ok: boolean; kind: string; model: string; detail: string }> {
  const config = readAiConfig();
  const model = resolveModel("smart_search", config);
  const notes: string[] = [];
  const inner = deps?.store ?? prismaUsageStore();
  const store: UsageStore = {
    async write(row) {
      if (!row.ok && row.errorDetail) notes.push(row.errorDetail);
      await inner.write(row);
    },
    monthSpendMicro: (since) => inner.monthSpendMicro(since),
    countSince: (query) => inner.countSince(query),
  };
  const result = await runAi(probePrompt, { query: "ping" }, { userId: actor.userId, actorHash: `admin:${actor.userId}` }, { store });
  if (result.ok) return { ok: true, kind: "ok", model: result.model || model, detail: "Connected." };
  return { ok: false, kind: result.kind, model, detail: notes[0] || plain(result.kind) };
}
