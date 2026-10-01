"use server";

import { revalidatePath } from "next/cache";
import { FEATURE_ENV } from "@/lib/ai/config";
import { reviewModerationFlag } from "@/lib/ai/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

const KEYS = new Set(Object.values(FEATURE_ENV));

export async function setAiKillSwitch(formData: FormData) {
  const admin = await requireAdmin();
  const key = field(formData, "key");
  if (!KEYS.has(key)) return;
  const enabled = field(formData, "enabled") === "1";
  await prisma.aiFlag.upsert({
    where: { key },
    create: { key, enabled, updatedById: admin.id },
    update: { enabled, updatedById: admin.id },
  });
  revalidatePath("/admin/ai");
}

export async function reviewModerationFlagAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const action = field(formData, "action");
  if (!id || (action !== "dismiss" && action !== "actioned")) return;
  await reviewModerationFlag({
    flagId: id,
    action,
    note: field(formData, "note"),
    adminId: admin.id,
    adminEmail: admin.email,
  });
  revalidatePath("/admin/ai/flags");
}
