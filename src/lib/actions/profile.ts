"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { normalizeContactPair } from "@/lib/phone";
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

  const phones = normalizeContactPair({
    phone: parsed.data.phone,
    whatsapp: parsed.data.whatsapp,
    city: parsed.data.city,
  });
  if (!phones.ok) return { error: phones.error, field: phones.field };

  await prisma.user.update({
    where: { id: user.id },
    data: { ...parsed.data, phone: phones.phone, whatsapp: phones.whatsapp },
  });
  const shop = await prisma.storefront.findUnique({ where: { userId: user.id }, select: { slug: true } });
  revalidatePath("/account");
  revalidatePath(`/people/${user.id}`);
  if (shop) revalidatePath(`/b/${shop.slug}`);
  redirect("/account?saved=1");
}
