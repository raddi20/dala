"use server";

import { AuthError } from "next-auth";
import { passwordLoginAllowed, normalizeEmail } from "@/lib/admin-access";
import { signIn } from "@/auth";
import { appName, defaultSiteUrl } from "@/lib/brand";
import { canSendMail, mailConfigProblems, sendMail, zeptoSkipLine } from "@/lib/email/zeptomail";
import { clientAddress } from "@/lib/client-address";
import { limitPasswordReset } from "@/lib/rate-limit";
import {
  consumeResetToken,
  issueResetToken,
  passwordResetTrace,
  planPasswordReset,
  resetEmailText,
  resetPasswordLink,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { safePath } from "@/lib/utils";
import { field, forgotPasswordSchema, resetPasswordSchema, type ActionState } from "@/lib/validators";

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(field(formData, "email"));
  const emailValid = forgotPasswordSchema.safeParse({ email }).success;
  if (!emailValid) {
    console.info(
      passwordResetTrace({
        emailValid: false,
        rateLimited: false,
        userFound: false,
        loginAllowed: false,
        mailConfigured: canSendMail(),
        tokenIssued: false,
        mailResult: "not attempted",
      }),
    );
    return { error: "Enter a valid email." };
  }

  const rateLimited = await limitPasswordReset(email, await clientAddress());
  const account = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  const mailConfigured = canSendMail();
  const loginAllowed = account ? passwordLoginAllowed(account.email, process.env) : false;
  const plan = planPasswordReset({
    emailValid: true,
    mailConfigured,
    rateLimited,
    accountExists: Boolean(account),
    loginAllowed,
  });
  let tokenIssued = false;
  let mailResult: "sent" | "skipped" | "failed" | "not attempted" = "not attempted";
  if (!mailConfigured) console.warn(zeptoSkipLine(mailConfigProblems(process.env)));
  if (plan.send && account) {
    const token = await issueResetToken(account.id, new Date());
    tokenIssued = Boolean(token);
    if (token) {
      const link = resetPasswordLink(defaultSiteUrl(), token, field(formData, "next"));
      const product = appName();
      mailResult = await sendMail({
        to: account.email,
        name: account.name,
        subject: `Reset your ${product} password`,
        text: resetEmailText(account.name, link, product),
      });
    }
  }
  console.info(
    passwordResetTrace({
      emailValid: true,
      rateLimited,
      userFound: Boolean(account),
      loginAllowed,
      mailConfigured,
      tokenIssued,
      mailResult,
    }),
  );
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
