"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { savePilotFlag } from "@/lib/send-home";
import { writeAdminAudit } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

export async function setSendHomePilot(formData: FormData) {
  const admin = await requireAdmin("/admin/send-home");
  const id = field(formData, "id");
  const on = field(formData, "on") === "1";
  const result = await savePilotFlag({
    id,
    on,
    find: (shopId) =>
      prisma.storefront.findUnique({
        where: { id: shopId },
        select: { id: true, sendHomePilot: true, slug: true, userId: true },
      }),
    update: async (shopId, next) => {
      await prisma.storefront.update({ where: { id: shopId }, data: { sendHomePilot: next } });
    },
    audit: (entry) => writeAdminAudit({ actor: admin, ...entry }),
  });
  revalidatePath("/admin/send-home");
  revalidatePath("/send-home");
  if (!result.ok) redirect("/admin/send-home?notice=missing");
  redirect("/admin/send-home?notice=saved");
}
