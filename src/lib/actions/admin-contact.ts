"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updateListingContact,
  updateUserContact,
  type ContactFormState,
  type ContactKind,
} from "@/lib/admin-contact";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

function actorOf(admin: { id: string; email: string; name: string }) {
  return { id: admin.id, email: admin.email, name: admin.name };
}

async function refreshContact(kind: ContactKind, id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/phones");
  revalidatePath(`/admin/contact/${kind}/${id}`);
  if (kind === "listing") {
    revalidatePath(`/listings/${id}`);
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { ownerId: true, owner: { select: { storefront: { select: { slug: true } } } } },
    });
    if (!listing) return;
    revalidatePath(`/people/${listing.ownerId}`);
    const slug = listing.owner.storefront?.slug;
    if (slug) revalidatePath(`/b/${slug}`);
    return;
  }
  revalidatePath(`/people/${id}`);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { storefront: { select: { slug: true } }, listings: { select: { id: true } } },
  });
  if (!user) return;
  if (user.storefront?.slug) revalidatePath(`/b/${user.storefront.slug}`);
  for (const listing of user.listings) revalidatePath(`/listings/${listing.id}`);
}

export async function saveAdminContact(
  prev: ContactFormState | null,
  formData: FormData,
): Promise<ContactFormState | null> {
  void prev;
  const admin = await requireAdmin("/admin");
  const kind = field(formData, "kind");
  const id = field(formData, "id");
  const input = {
    phone: field(formData, "phone"),
    whatsapp: field(formData, "whatsapp"),
    reason: field(formData, "reason"),
  };
  if ((kind !== "listing" && kind !== "user") || !id) {
    return { error: "That record is no longer there.", field: "phone" };
  }
  const actor = actorOf(admin);
  const result =
    kind === "listing"
      ? await updateListingContact(prisma, actor, id, input)
      : await updateUserContact(prisma, actor, id, input);
  if (!result.ok) return { error: result.error, field: result.field };
  await refreshContact(kind, id);
  redirect(`/admin/contact/${kind}/${id}?saved=1`);
}
