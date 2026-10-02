"use server";

import { revalidatePath } from "next/cache";
import { setTipsEmailOptIn } from "@/lib/ai/seller-tips";
import { requireUser } from "@/lib/session";
import { field } from "@/lib/validators";

export async function setTipsEmailPreference(formData: FormData) {
  const user = await requireUser("/account/insights");
  await setTipsEmailOptIn(user.id, field(formData, "optIn") === "1");
  revalidatePath("/account/insights");
}
