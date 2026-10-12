import type { PrismaClient } from "@prisma/client";
import type { AdminActor } from "@/lib/moderation";
import { commitPhonePlans, phoneAuditReason, planPhoneRow, readPhoneRows, writePhonePlan, type PhoneRowPlan } from "@/lib/phone";

export const PHONE_NORMALISE_ACTION = "phones.normalise";

export type PhoneApplyResult = {
  written: number;
  reason: string;
  plans: PhoneRowPlan[];
};

/**
 * Re-reads stored numbers, writes only rows that can be normalised, and appends one audit entry.
 * A second call finds nothing to change and does not write another audit row.
 * Unreadable numbers, including a 13-digit 254… value, are left as they are.
 */
export async function applyStoredPhones(db: PrismaClient, actor: AdminActor): Promise<PhoneApplyResult> {
  return db.$transaction(async (tx) => {
    const plans = (await readPhoneRows(tx)).map(planPhoneRow);
    const written = await commitPhonePlans(plans, true, (plan) => writePhonePlan(tx, plan));
    if (written === 0) return { written: 0, reason: "", plans };
    const reason = phoneAuditReason(plans);
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        action: PHONE_NORMALISE_ACTION,
        targetType: "phones",
        targetId: "stored",
        reason,
      },
    });
    return { written, reason, plans };
  });
}
