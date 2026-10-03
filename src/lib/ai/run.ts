import { featureBlockedByBudget, budgetTier, monthStartUtc, worstCaseMicro, wouldCrossBudget } from "@/lib/ai/budget";
import type { AiConfig } from "@/lib/ai/config";
import { readAiConfig } from "@/lib/ai/config";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { isRateCapped } from "@/lib/ai/limits";
import { costMicroUsd, estimateTokensFromText, lookupPrice } from "@/lib/ai/prices";
import type { PromptSpec } from "@/lib/ai/prompts/types";
import { isAbortError } from "@/lib/ai/providers/errors";
import { getProvider, resolveModel } from "@/lib/ai/registry";
import { noteRuntimeWarning } from "@/lib/ai/status";
import {
  AiError,
  type AIProvider,
  type AiActor,
  type AiErrorKind,
  type AiFeature,
  type ImagePart,
  type ProviderName,
  type RunResult,
  type Usage,
} from "@/lib/ai/types";
import { prismaUsageStore, type UsageRow, type UsageStore } from "@/lib/ai/usage";

const BATCH_DEADLINE_MS = 30_000;
const FAILURE_WINDOW_MS = 60_000;
const OPEN_MS = 60_000;
const BREAKER_LIMIT = 5;

export function isBatchFeature(feature: AiFeature): boolean {
  return feature === "moderation" || feature === "seller_tips";
}

export function perAttemptMs(feature: AiFeature): number {
  if (feature === "smart_search" || feature === "family_helper") return 4_000;
  if (feature === "listing_writer") return 7_000;
  return 15_000;
}

export type Circuit = { failures: number[]; openUntil: number };

export function createCircuit(): Circuit {
  return { failures: [], openUntil: 0 };
}

export function circuitOpen(circuit: Circuit, now: number): boolean {
  return now < circuit.openUntil;
}

export function noteCircuitFailure(circuit: Circuit, now: number) {
  circuit.failures = circuit.failures.filter((stamp) => now - stamp < FAILURE_WINDOW_MS);
  circuit.failures.push(now);
  if (circuit.failures.length >= BREAKER_LIMIT) circuit.openUntil = now + OPEN_MS;
}

export function noteCircuitSuccess(circuit: Circuit) {
  circuit.failures = [];
  circuit.openUntil = 0;
}

export type Clock = { now(): number; sleep(ms: number): Promise<void> };

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type RunDeps = {
  config?: AiConfig;
  env?: NodeJS.ProcessEnv;
  store?: UsageStore;
  clock?: Clock;
  random?: () => number;
  circuit?: Circuit;
  providers?: Partial<Record<ProviderName, AIProvider>>;
  featureOn?: (feature: AiFeature) => Promise<boolean>;
};

type Rendered = { text: string; images?: ImagePart[] };

export async function runAi<I, O>(
  spec: PromptSpec<I, O>,
  input: I,
  actor: AiActor = {},
  deps: RunDeps = {},
): Promise<RunResult<O>> {
  const env = deps.env ?? process.env;
  const config = deps.config ?? readAiConfig(env);
  const store = deps.store ?? prismaUsageStore();
  const clock = deps.clock ?? realClock;
  const random = deps.random ?? Math.random;
  const circuit = deps.circuit ?? sharedCircuit;

  if (config.disabled) return { ok: false, kind: "disabled" };
  const enabled = deps.featureOn ? await deps.featureOn(spec.feature) : await isAiFeatureOn(spec.feature, { env });
  if (!enabled) return { ok: false, kind: "disabled" };

  const batch = isBatchFeature(spec.feature);
  const spent = await store.monthSpendMicro(monthStartUtc(new Date(clock.now())));
  if (featureBlockedByBudget(spec.feature, budgetTier(spent, config.monthlyBudgetUsd))) {
    return { ok: false, kind: "over_budget" };
  }

  const model = resolveModel(spec.feature, config);
  const priced = lookupPrice(config.provider, model, { inPerM: config.priceInPerM, outPerM: config.priceOutPerM });
  if (priced.warning) noteRuntimeWarning(priced.warning);
  const rendered = spec.render(input);
  const estimateIn = estimateTokensFromText(`${spec.system}\n${rendered.text}`) + (rendered.images?.length ?? 0) * 1100;
  if (wouldCrossBudget(spent, worstCaseMicro(estimateIn, spec.maxOutputTokens, priced.price, batch), config.monthlyBudgetUsd)) {
    return { ok: false, kind: "over_budget" };
  }

  if (await isRateCapped(spec.feature, actor, clock.now(), (query) => store.countSince(query))) {
    return { ok: false, kind: "rate_capped" };
  }

  const deadline = clock.now() + (batch ? BATCH_DEADLINE_MS : config.timeoutMs);
  const maxRetries = config.maxRetries ?? (batch ? 2 : 1);
  let attempt = 0;
  const nextAttempt = () => {
    attempt += 1;
    return attempt;
  };

  let failureKind: AiErrorKind = "timeout";
  const primary = deps.providers?.[config.provider] ?? getProvider(config.provider, config);
  if (!circuitOpen(circuit, clock.now())) {
    const primaryResult = await attemptProvider({
      spec,
      input,
      rendered,
      provider: primary,
      providerName: config.provider,
      model,
      actor,
      store,
      clock,
      random,
      circuit,
      deadline,
      maxRetries,
      batch,
      isFallback: false,
      config,
      nextAttempt,
    });
    if (primaryResult.ok) return primaryResult.result;
    failureKind = primaryResult.kind;
    if (primaryResult.kind === "auth") noteRuntimeWarning(`${config.provider} rejected the API key.`);
  } else {
    failureKind = "server";
  }

  if (!config.fallback || clock.now() >= deadline) return { ok: false, kind: failureKind };

  const fallbackProvider = deps.providers?.[config.fallback.provider] ?? getProvider(config.fallback.provider, config);
  const fallbackResult = await attemptProvider({
    spec,
    input,
    rendered,
    provider: fallbackProvider,
    providerName: config.fallback.provider,
    model: config.fallback.model,
    actor,
    store,
    clock,
    random,
    circuit,
    deadline,
    maxRetries: 0,
    batch: false,
    isFallback: true,
    config,
    nextAttempt,
  });
  if (fallbackResult.ok) return fallbackResult.result;
  if (fallbackResult.kind === "auth") noteRuntimeWarning(`${config.fallback.provider} rejected the API key.`);
  return { ok: false, kind: fallbackResult.kind };
}

type AttemptArgs<I, O> = {
  spec: PromptSpec<I, O>;
  input: I;
  rendered: Rendered;
  provider: AIProvider;
  providerName: ProviderName;
  model: string;
  actor: AiActor;
  store: UsageStore;
  clock: Clock;
  random: () => number;
  circuit: Circuit;
  deadline: number;
  maxRetries: number;
  batch: boolean;
  isFallback: boolean;
  config: AiConfig;
  nextAttempt: () => number;
};

async function attemptProvider<I, O>(
  args: AttemptArgs<I, O>,
): Promise<{ ok: true; result: RunResult<O> } | { ok: false; kind: AiErrorKind }> {
  let retries = 0;
  let repaired = false;
  let lastKind: AiErrorKind = "timeout";
  while (args.clock.now() < args.deadline) {
    if (!args.isFallback && circuitOpen(args.circuit, args.clock.now())) break;
    // Interactive calls use AI_TIMEOUT_MS for the attempt. The shorter per-feature cap
    // was aborting smart search at 4s even when the env timeout was 8s, then retrying.
    const attemptCap = args.batch ? perAttemptMs(args.spec.feature) : args.config.timeoutMs;
    const timeoutMs = Math.min(args.deadline - args.clock.now(), attemptCap);
    if (timeoutMs <= 0) break;
    const attempt = args.nextAttempt();
    const started = args.clock.now();
    try {
      const generated = await withTimeout(timeoutMs, (signal) =>
        args.provider.generateStructured({
          feature: args.spec.feature,
          model: args.model,
          system: args.spec.system,
          text: args.rendered.text,
          images: args.rendered.images,
          schema: args.spec.schema,
          schemaName: args.spec.schemaName,
          maxOutputTokens: args.spec.maxOutputTokens,
          temperature: args.spec.temperature,
          timeoutMs,
          signal,
        }),
      );
      const checked = args.spec.postCheck ? args.spec.postCheck(generated.data, args.input) : generated.data;
      if (checked === null) throw new AiError("invalid_output", "The output failed the extra check.", false, generated.usage);
      await writeRow(args, {
        attempt,
        ok: true,
        error: "",
        usage: generated.usage,
        costMicroUsd: generated.costMicroUsd,
        latencyMs: Math.max(1, args.clock.now() - started),
      });
      if (!args.isFallback) noteCircuitSuccess(args.circuit);
      return {
        ok: true,
        result: {
          ok: true,
          data: checked,
          provider: generated.provider,
          model: generated.model,
          costMicroUsd: generated.costMicroUsd,
          latencyMs: generated.latencyMs,
        },
      };
    } catch (error) {
      const ai = toAiError(error);
      lastKind = ai.kind;
      await writeRow(args, {
        attempt,
        ok: false,
        error: ai.kind,
        errorDetail: ai.message.slice(0, 300),
        usage: ai.usage,
        costMicroUsd: failureCost(args, ai.usage),
        latencyMs: Math.max(1, args.clock.now() - started),
      });
      if (!args.isFallback) noteCircuitFailure(args.circuit, args.clock.now());
      if (ai.kind === "invalid_output" && args.batch && !repaired) {
        repaired = true;
        continue;
      }
      const stopNow = ai.kind === "auth" || ai.kind === "refused" || ai.kind === "bad_request" || ai.kind === "invalid_output" || !ai.retryable;
      if (stopNow || retries >= args.maxRetries) break;
      const backoff = Math.round(300 * 2 ** retries * (1 + args.random() * 0.2));
      const wait = Math.max(backoff, ai.retryAfterMs ?? 0);
      retries += 1;
      if (args.clock.now() + wait >= args.deadline) break;
      await args.clock.sleep(wait);
    }
  }
  return { ok: false, kind: lastKind };
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (isAbortError(error)) return new AiError("timeout", "The model timed out.", true);
  return new AiError("server", "The model failed.", true);
}

function failureCost<I, O>(args: AttemptArgs<I, O>, usage: Usage | undefined): number {
  if (!usage) return 0;
  const price = lookupPrice(args.providerName, args.model, {
    inPerM: args.config.priceInPerM,
    outPerM: args.config.priceOutPerM,
  }).price;
  return costMicroUsd(usage.inputTokens, usage.outputTokens, price, args.batch);
}

async function writeRow<I, O>(
  args: AttemptArgs<I, O>,
  row: {
    attempt: number;
    ok: boolean;
    error: string;
    errorDetail?: string | null;
    usage?: Usage;
    costMicroUsd: number;
    latencyMs: number;
  },
) {
  const stored: UsageRow = {
    feature: args.spec.feature,
    provider: args.providerName,
    model: args.model,
    userId: args.actor.userId ?? "",
    actorHash: args.actor.actorHash ?? "",
    inputTokens: row.usage?.inputTokens ?? 0,
    outputTokens: row.usage?.outputTokens ?? 0,
    costMicroUsd: row.costMicroUsd,
    ok: row.ok,
    error: row.error,
    errorDetail: row.ok ? null : row.errorDetail?.slice(0, 300) || null,
    latencyMs: row.latencyMs,
    attempt: row.attempt,
    isFallback: args.isFallback,
    promptVersion: args.spec.version,
    estimated: Boolean(row.usage?.estimated),
  };
  await args.store.write(stored);
}

function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let settled = false;
  return new Promise((resolve, reject) => {
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      settle();
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish(() => reject(new AiError("timeout", "The model timed out.", true)));
    }, ms);
    fn(controller.signal).then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

const sharedCircuit = createCircuit();
