"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveLeadUpdate } from "@/lib/business-lead";
import { writeAdminAudit } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

export async function updateBusinessLead(formData: FormData) {
  const admin = await requireAdmin("/admin/business");
  const id = field(formData, "id");
  const result = await saveLeadUpdate({
    id,
    status: field(formData, "status"),
    adminNotes: field(formData, "adminNotes"),
    find: (leadId) =>
      prisma.businessLead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true, adminNotes: true },
      }),
    update: async (leadId, data) => {
      await prisma.businessLead.update({ where: { id: leadId }, data });
    },
    audit: (entry) => writeAdminAudit({ actor: admin, ...entry }),
  });
  revalidatePath("/admin/business");
  if (!result.ok) redirect(`/admin/business?notice=${result.code}`);
  if (result.changed) redirect("/admin/business?notice=saved");
  redirect("/admin/business");
}
