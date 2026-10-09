"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { normalizeEmail, registrationBlockReason } from "@/lib/admin-access";
import { AGENT_COOKIE } from "@/lib/agent-code";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createRegisteredUser } from "@/lib/register-user";
import { safePath } from "@/lib/utils";
import { field, registerSchema, type ActionState } from "@/lib/validators";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(field(formData, "email"));
  const password = field(formData, "password");
  const next = safePath(field(formData, "next"), "/");

  try {
    await signIn("credentials", { email, password, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is wrong." };
    }
    throw error;
  }
  return { error: "" };
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    kind: field(formData, "kind"),
    city: field(formData, "city"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const email = normalizeEmail(parsed.data.email);
  const reserved = registrationBlockReason(email, process.env);
  if (reserved) return { error: reserved };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const jar = await cookies();
  const created = await createRegisteredUser(
    {
      findByEmail: (address) => prisma.user.findUnique({ where: { email: address }, select: { referralAgentCode: true } }),
      create: (data) => prisma.user.create({ data, select: { id: true, referralAgentCode: true } }),
    },
    {
      name: parsed.data.name,
      email,
      passwordHash,
      kind: parsed.data.kind,
      city: parsed.data.city,
      agentCookie: jar.get(AGENT_COOKIE)?.value,
    },
  );
  if (!created.ok) return { error: created.error };

  const next = safePath(field(formData, "next"), "/");
  try {
    await signIn("credentials", { email, password: parsed.data.password, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try the login page." };
    }
    throw error;
  }
  return { error: "" };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
