"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVideoBackend } from "@/lib/video/backend";
import { approveShopVideo, rejectShopVideo, removeLiveShopVideo } from "@/lib/video/service";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

function refresh(slug: string) {
  revalidatePath("/admin");
  revalidatePath("/account/storefront");
  revalidatePath("/listings");
  revalidatePath("/");
  revalidatePath("/occasions");
  if (slug) revalidatePath(`/b/${slug}`);
}

function back(message: string): never {
  redirect(`/admin?videoNotice=${encodeURIComponent(message)}#shop-videos`);
}

export async function approveShopVideoAction(formData: FormData) {
  const admin = await requireAdmin();
  const backend = await getVideoBackend();
  if (!backend) back("Shop video is not configured.");
  const result = await approveShopVideo(prisma, backend, {
    role: admin.role,
    videoId: field(formData, "videoId"),
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
  if (!result.ok) back(result.error);
  refresh(result.slug);
  back("Approved. The video is on the shop.");
}

export async function rejectShopVideoAction(formData: FormData) {
  const admin = await requireAdmin();
  const result = await rejectShopVideo(prisma, {
    role: admin.role,
    videoId: field(formData, "videoId"),
    reason: field(formData, "reason"),
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
  if (!result.ok) back(result.error);
  refresh(result.slug);
  back("Rejected. The seller will see the reason on their shop page.");
}

export async function removeLiveShopVideoAction(formData: FormData) {
  const admin = await requireAdmin();
  const backend = await getVideoBackend();
  if (!backend) back("Shop video is not configured.");
  const result = await removeLiveShopVideo(prisma, backend, {
    role: admin.role,
    videoId: field(formData, "videoId"),
    reason: field(formData, "reason"),
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
  if (!result.ok) back(result.error);
  refresh(result.slug);
  back("Removed from the shop.");
}
