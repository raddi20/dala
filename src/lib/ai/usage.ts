import { prisma } from "@/lib/prisma";
import type { AiFeature } from "@/lib/ai/types";

export type UsageRow = {
  feature: string;
  provider: string;
  model: string;
  userId: string;
  actorHash: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  ok: boolean;
  error: string;
  errorDetail?: string | null;
  latencyMs: number;
  attempt: number;
  isFallback: boolean;
  promptVersion: string;
  estimated: boolean;
};

export type UsageStore = {
  write(row: UsageRow): Promise<void>;
  monthSpendMicro(since: Date): Promise<number>;
  countSince(query: { feature: AiFeature; since: Date; userId?: string; actorHash?: string }): Promise<number>;
};

export function prismaUsageStore(): UsageStore {
  return {
    async write(row) {
      await prisma.aiUsage.create({ data: row });
    },
    async monthSpendMicro(since) {
      const total = await prisma.aiUsage.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { costMicroUsd: true },
      });
      return total._sum.costMicroUsd ?? 0;
    },
    async countSince(query) {
      return prisma.aiUsage.count({
        where: {
          feature: query.feature,
          createdAt: { gte: query.since },
          ...(query.userId ? { userId: query.userId } : {}),
          ...(query.actorHash ? { actorHash: query.actorHash } : {}),
        },
      });
    },
  };
}
