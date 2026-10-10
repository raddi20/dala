"use server";

import { AuthError } from "next-auth";
import { passwordLoginAllowed, normalizeEmail } from "@/lib/admin-access";
import { signIn } from "@/auth";
import { appName, defaultSiteUrl } from "@/lib/brand";
import { canSendMail, sendMail } from "@/lib/email/zeptomail";
import {
  consumeResetToken,
  issueResetToken,
  planPasswordReset,
  resetEmailText,
  resetPasswordLink,
  takeResetSlot,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { safePath } from "@/lib/utils";
import { field, forgotPasswordSchema, resetPasswordSchema, type ActionState } from "@/lib/validators";

async function requestIp(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const bag = await headers();
    const forwarded = bag.get("x-forwarded-for") ?? "";
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) return first.slice(0, 80);
    return (bag.get("x-real-ip")?.trim() ?? "unknown").slice(0, 80) || "unknown";
  } catch {
    return "unknown";
  }
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(field(formData, "email"));
  const emailValid = forgotPasswordSchema.safeParse({ email }).success;
  if (!emailValid) return { error: "Enter a valid email." };

  const rateLimited = takeResetSlot(email, await requestIp(), Date.now());
  const account = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  const plan = planPasswordReset({
    emailValid: true,
    mailConfigured: canSendMail(),
    rateLimited,
    accountExists: Boolean(account),
    loginAllowed: account ? passwordLoginAllowed(account.email, process.env) : false,
  });
  if (plan.send && account) {
    const token = await issueResetToken(account.id, new Date());
    if (token) {
      const link = resetPasswordLink(defaultSiteUrl(), token, field(formData, "next"));
      const product = appName();
      const sent = await sendMail({
        to: account.email,
        name: account.name,
        subject: `Reset your ${product} password`,
        text: resetEmailText(account.name, link, product),
      });
      if (sent !== "sent") console.error("Password reset email was not sent", account.email);
    }
  }
  return { error: "", message: plan.message };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: field(formData, "token"),
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const result = await consumeResetToken(parsed.data.token, parsed.data.password, new Date());
  if (!result.ok) return { error: result.error };

  try {
    await signIn("credentials", {
      email: result.email,
      password: parsed.data.password,
      redirectTo: safePath(field(formData, "next"), "/"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Password updated. Sign in with the new one." };
    }
    throw error;
  }
  return { error: "" };
}
