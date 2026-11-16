"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAdminAudit } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { addRecruiter, editRecruiter } from "@/lib/recruiter";
import { requireAdmin } from "@/lib/session";
import { field } from "@/lib/validators";

export async function addShopRecruiter(formData: FormData) {
  const admin = await requireAdmin("/admin/recruiters");
  let result: Awaited<ReturnType<typeof addRecruiter>>;
  try {
    result = await addRecruiter({
      code: field(formData, "code"),
      name: field(formData, "name"),
      findByCode: (code) => prisma.recruiter.findUnique({ where: { code }, select: { id: true } }),
      create: (data) => prisma.recruiter.create({ data, select: { id: true, code: true } }),
      audit: (entry) => writeAdminAudit({ actor: admin, ...entry }),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/recruiters?notice=taken");
    }
    throw error;
  }
  revalidatePath("/admin/recruiters");
  if (!result.ok) redirect(`/admin/recruiters?notice=${result.code}`);
  redirect("/admin/recruiters?notice=added");
}

export async function updateShopRecruiter(formData: FormData) {
  const admin = await requireAdmin("/admin/recruiters");
  const result = await editRecruiter({
    id: field(formData, "id"),
    name: field(formData, "name"),
    active: field(formData, "active"),
    find: (id) =>
      prisma.recruiter.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, active: true },
      }),
    update: async (id, data) => {
      await prisma.recruiter.update({ where: { id }, data });
    },
    audit: (entry) => writeAdminAudit({ actor: admin, ...entry }),
  });
  revalidatePath("/admin/recruiters");
  if (!result.ok) redirect(`/admin/recruiters?notice=${result.code}`);
  if (result.changed) redirect("/admin/recruiters?notice=saved");
  redirect("/admin/recruiters");
}
