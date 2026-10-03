"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FEATURE_ENV } from "@/lib/ai/config";
import { reviewModerationFlag } from "@/lib/ai/moderation";
import { probeGeminiConnection } from "@/lib/ai/probe";
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

export async function clearSearchCacheAction() {
  await requireAdmin();
  await prisma.aiSearchCache.deleteMany();
  revalidatePath("/admin/ai");
  redirect("/admin/ai?cache=cleared");
}

export async function probeGeminiAction() {
  const admin = await requireAdmin();
  const result = await probeGeminiConnection({ userId: admin.id });
  const params = new URLSearchParams({
    probe: result.kind,
    probeModel: result.model,
    probeDetail: result.detail.slice(0, 300),
  });
  redirect(`/admin/ai?${params.toString()}`);
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
