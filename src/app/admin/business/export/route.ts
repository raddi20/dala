import { NextResponse } from "next/server";
import { businessLeadsCsv } from "@/lib/business-lead";
import { writeAdminAudit } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin("/admin/business");
  const rows = await prisma.businessLead.findMany({ orderBy: { createdAt: "desc" } });
  await writeAdminAudit({
    actor: admin,
    action: "business_lead.export",
    targetType: "business_lead",
    targetId: "csv",
    reason: `CSV export, ${rows.length} rows.`,
  });
  const body = businessLeadsCsv(rows);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rangach-business-leads.csv"',
      "Cache-Control": "no-store",
    },
  });
}
