import type { Metadata } from "next";
import Link from "next/link";
import { probeGeminiAction, setAiKillSwitch } from "@/app/admin/ai/actions";
import { btnSecondary } from "@/components/ui";
import { FEATURE_ENV, readAiConfig } from "@/lib/ai/config";
import { budgetTier, monthStartUtc } from "@/lib/ai/budget";
import { runtimeWarnings } from "@/lib/ai/status";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "AI" };
export const dynamic = "force-dynamic";

function usd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(4)}`;
}

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const probeKind = one(params.probe);
  const probeModel = one(params.probeModel);
  const probeDetail = one(params.probeDetail);
  const config = readAiConfig();
  const start = monthStartUtc(new Date());
  const [usage, flags, failures] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["feature", "provider", "ok"],
      where: { createdAt: { gte: start } },
      _sum: { costMicroUsd: true },
      _count: { _all: true },
    }),
    prisma.aiFlag.findMany(),
    prisma.aiUsage.findMany({
      where: { createdAt: { gte: start }, ok: false },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { feature: true, model: true, error: true, errorDetail: true, createdAt: true },
    }),
  ]);
  const spent = usage.reduce((sum, row) => sum + (row._sum.costMicroUsd ?? 0), 0);
  const tier = budgetTier(spent, config.monthlyBudgetUsd);
  const killed = new Map(flags.map((flag) => [flag.key, flag.enabled]));
  const warnings = [...config.warnings, ...runtimeWarnings()];
  const errorsByFeature = new Map<string, typeof failures>();
  for (const row of failures) {
    const list = errorsByFeature.get(row.feature) ?? [];
    if (list.length >= 10) continue;
    list.push(row);
    errorsByFeature.set(row.feature, list);
  }

  const byFeature = new Map<string, { calls: number; errors: number; cost: number }>();
  const byProvider = new Map<string, { calls: number; cost: number }>();
  for (const row of usage) {
    const feature = byFeature.get(row.feature) ?? { calls: 0, errors: 0, cost: 0 };
    feature.calls += row._count._all;
    if (!row.ok) feature.errors += row._count._all;
    feature.cost += row._sum.costMicroUsd ?? 0;
    byFeature.set(row.feature, feature);
    const provider = byProvider.get(row.provider) ?? { calls: 0, cost: 0 };
    provider.calls += row._count._all;
    provider.cost += row._sum.costMicroUsd ?? 0;
    byProvider.set(row.provider, provider);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">AI usage</h1>
        <p className="mt-1 text-sm text-ink/70">
          This month, from {start.toISOString().slice(0, 10)}. The database switch can only turn a feature off. The env
          flag still has to be 1.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin/ai/flags" className="font-semibold text-lake-dark underline">
            Moderation suggestions
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Moderation
          </Link>
        </p>
      </div>

      {tier === "all_off" ? (
        <p className="rounded-xl border border-danger/30 bg-red-50 px-3 py-2 text-sm" role="status">
          All AI is off. Monthly spend is at the cap ({usd(spent)} of ${config.monthlyBudgetUsd.toFixed(2)}).
        </p>
      ) : null}
      {tier === "public_off" ? (
        <p className="rounded-xl border border-clay/40 bg-amber-50 px-3 py-2 text-sm" role="status">
          Smart search and the family helper are off. Monthly spend is at 80% of the cap ({usd(spent)} of $
          {config.monthlyBudgetUsd.toFixed(2)}).
        </p>
      ) : null}
      {probeKind ? (
        <p className="rounded-xl border border-sand bg-card px-3 py-2 text-sm" role="status">
          Gemini test{probeModel ? ` (${probeModel})` : ""}: {probeKind}. {probeDetail}
        </p>
      ) : null}
      {config.disabledReason ? <p className="text-sm text-ink/70">{config.disabledReason}</p> : null}
      {warnings.map((warning) => (
        <p key={warning} className="text-sm text-ink/70">
          {warning}
        </p>
      ))}

      <section className="grid gap-2 text-sm">
        <h2 className="font-serif text-2xl">This month</h2>
        <p>
          Provider: {config.provider}
          {config.disabled ? " (disabled)" : ""}. Spend {usd(spent)}. Cap ${config.monthlyBudgetUsd.toFixed(2)}.
        </p>
        {[...byFeature.entries()].map(([feature, row]) => (
          <p key={feature}>
            {feature}: {row.calls} calls, {row.errors} errors, {usd(row.cost)}
          </p>
        ))}
        {byFeature.size === 0 ? <p className="text-ink/70">No AI calls yet.</p> : null}
        {[...errorsByFeature.entries()].map(([feature, rows]) => (
          <div key={feature} className="mt-2 grid gap-1">
            <p className="font-semibold">{feature} errors</p>
            {rows.map((row, index) => (
              <p key={`${row.createdAt.toISOString()}-${index}`} className="text-ink/70">
                {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {row.model || "no model"} · {row.error || "unknown"}
                {row.errorDetail ? ` · ${row.errorDetail}` : " · no detail stored"}
              </p>
            ))}
          </div>
        ))}
        {[...byProvider.entries()].map(([provider, row]) => (
          <p key={provider} className="text-ink/70">
            {provider}: {row.calls} calls, {usd(row.cost)}
          </p>
        ))}
      </section>

      <section className="grid gap-2 text-sm">
        <h2 className="font-serif text-2xl">Gemini connection</h2>
        <p className="text-ink/70">
          Sends one short call on the fast model and records it here. It counts toward the monthly cap. The message is the
          provider error, not the prompt.
        </p>
        <form action={probeGeminiAction}>
          <button className={btnSecondary} type="submit">
            Test Gemini connection
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Kill switches</h2>
        {Object.entries(FEATURE_ENV).map(([feature, key]) => {
          const envOn = process.env[key] === "1";
          const rowEnabled = killed.get(key);
          const killedOff = rowEnabled === false;
          return (
            <form key={key} action={setAiKillSwitch} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-card p-4 text-sm">
              <div>
                <p className="font-semibold">{feature}</p>
                <p className="text-ink/70">
                  {key} is {envOn ? "1" : "unset"}. {killedOff ? "Switched off here." : "Not switched off here."}
                </p>
              </div>
              <input type="hidden" name="key" value={key} />
              <input type="hidden" name="enabled" value={killedOff ? "1" : "0"} />
              <button className={btnSecondary} type="submit">
                {killedOff ? "Allow again" : "Switch off"}
              </button>
            </form>
          );
        })}
      </section>
    </div>
  );
}
