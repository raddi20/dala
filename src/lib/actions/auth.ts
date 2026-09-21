"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safePath } from "@/lib/utils";
import { field, registerSchema, type ActionState } from "@/lib/validators";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = field(formData, "email").toLowerCase().trim();
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

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "That email is already registered." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      kind: parsed.data.kind,
      city: parsed.data.city,
    },
  });

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
