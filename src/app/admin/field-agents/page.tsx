import type { Metadata } from "next";
import { AgentCountTable } from "@/components/admin-agent-counts";
import { countAgentSignups, knownAgentCodes, resolveAgentRange } from "@/lib/agent-code";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Field agents" };

export default async function AdminFieldAgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/field-agents");
  const params = await searchParams;
  const agentRange = resolveAgentRange({
    agents: one(params.agents),
    from: one(params.agentFrom),
    to: one(params.agentTo),
  });
  const agentUsers = await prisma.user.findMany({
    select: {
      referralAgentCode: true,
      referralAgentAt: true,
      createdAt: true,
      suspended: true,
      storefront: {
        select: {
          id: true,
          published: true,
          hidden: true,
          _count: { select: { offerings: { where: { archived: false } } } },
        },
      },
      _count: { select: { listings: true } },
    },
  });
  const knownCodes = knownAgentCodes();
  const agentCounts = countAgentSignups(
    agentUsers.map((person) => ({
      code: person.referralAgentCode,
      at: person.referralAgentAt ?? person.createdAt,
      hasShop: person.storefront !== null,
      hasPublishedShop: Boolean(
        person.storefront?.published && !person.storefront.hidden && !person.suspended,
      ),
      hasOffering: (person.storefront?._count.offerings ?? 0) > 0,
      hasListing: person._count.listings > 0,
    })),
    { knownCodes, from: agentRange.from, to: agentRange.to },
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <AgentCountTable rows={agentCounts} range={agentRange} />
    </div>
  );
}
