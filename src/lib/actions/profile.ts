"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { field, profileSchema, type ActionState } from "@/lib/validators";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to edit your profile." };

  const parsed = profileSchema.safeParse({
    name: field(formData, "name"),
    kind: field(formData, "kind"),
    city: field(formData, "city"),
    bio: field(formData, "bio"),
    phone: field(formData, "phone"),
    whatsapp: field(formData, "whatsapp"),
    avatarUrl: field(formData, "avatarUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/account");
  revalidatePath(`/people/${user.id}`);
  redirect("/account?saved=1");
}
