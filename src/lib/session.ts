import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

export async function requireUser(next = "/") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}
