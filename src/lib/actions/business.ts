"use server";

import { cookies } from "next/headers";
import { AGENT_COOKIE } from "@/lib/agent-code";
import { BUSINESS_LEAD_THANKS, HONEYPOT_FIELD, takeBusinessLead } from "@/lib/business-lead";
import { clientAddress } from "@/lib/client-address";
import { limitBusinessLead } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { field, type ActionState } from "@/lib/validators";

export async function createBusinessLead(_state: ActionState, formData: FormData): Promise<ActionState> {
  const jar = await cookies();
  const result = await takeBusinessLead({
    fields: {
      businessName: field(formData, "businessName"),
      contactName: field(formData, "contactName"),
      phone: field(formData, "phone"),
      town: field(formData, "town"),
      tier: field(formData, "tier"),
      notes: field(formData, "notes"),
      refCode: field(formData, "refCode"),
      agentCode: field(formData, "agentCode"),
      companyUrl: field(formData, HONEYPOT_FIELD),
    },
    ip: await clientAddress(),
    agentCookie: jar.get(AGENT_COOKIE)?.value ?? null,
    limit: (ip) => limitBusinessLead(ip),
    create: async (draft) => {
      await prisma.businessLead.create({ data: draft });
    },
  });
  if (!result.ok) return { error: result.error, field: result.field };
  return { error: "", ok: true, message: BUSINESS_LEAD_THANKS };
}
