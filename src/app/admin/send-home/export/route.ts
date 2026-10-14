import { NextResponse } from "next/server";
import { waitlistCsv } from "@/lib/send-home";
import { writeAdminAudit } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin("/admin/send-home");
  const rows = await prisma.diasporaWaitlist.findMany({ orderBy: { createdAt: "desc" } });
  await writeAdminAudit({
    actor: admin,
    action: "diaspora_waitlist.export",
    targetType: "diaspora_waitlist",
    targetId: "csv",
    reason: `CSV export, ${rows.length} rows.`,
  });
  return new NextResponse(waitlistCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rangach-send-home-waitlist.csv"',
      "Cache-Control": "no-store",
    },
  });
}
