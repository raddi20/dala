import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { passwordLoginAllowed } from "@/lib/admin-access";
import { APP_TAGLINE } from "@/lib/brand";
import { CONTACT_EMAIL } from "@/lib/public-info";
import { prisma } from "@/lib/prisma";
import { safePath } from "@/lib/utils";

/** High-entropy reset links last 45 minutes, inside the 30–60 minute window. */
export const RESET_TTL_MS = 45 * 60 * 1000;
export const RESET_TTL_MINUTES = 45;
export const RESET_EMAIL_LIMIT = 5;
export const RESET_IP_LIMIT = 20;
export const RESET_WINDOW_MS = 60 * 60 * 1000;

export const RESET_LINK_INVALID = "This link has expired or was already used. Ask for a new one.";

export const RESET_NEUTRAL =
  "If an account exists for that email, we sent a link to choose a new password. The link lasts 45 minutes.";

export const RESET_MAIL_OFF = `Password reset email is not set up yet. Write to ${CONTACT_EMAIL} and we will help you sign in.`;

const hits = new Map<string, number[]>();

export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenUsable(row: { usedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  if (row.usedAt) return false;
  return row.expiresAt.getTime() > now.getTime();
}

/**
 * True when this signed-in session was issued before the password changed.
 * A null passwordChangedAt means the account has never reset, so older sessions stay.
 */
export function sessionStale(tokenPwdAt: number, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return false;
  const changed = passwordChangedAt.getTime();
  if (!Number.isFinite(changed) || changed <= 0) return false;
  if (!Number.isFinite(tokenPwdAt)) return true;
  return changed > tokenPwdAt;
}

/** Reset URL. A safe return path other than "/" is kept as next. Unsafe values are dropped. */
export function resetPasswordLink(origin: string, token: string, next: string): string {
  const base = `${origin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const dest = safePath(next, "/");
  if (dest === "/") return base;
  return `${base}&next=${encodeURIComponent(dest)}`;
}

export function resetEmailText(name: string, link: string, product = "Rangach"): string {
  const who = name.trim();
  const hello = who ? `Hello ${who},` : "Hello,";
  return [
    hello,
    "",
    `We received a request to reset the password for your ${product} account.`,
    "",
    `Open this link and choose a new password. It works once and lasts ${RESET_TTL_MINUTES} minutes.`,
    "",
    link,
    "",
    "If you did not ask, ignore this note. Your password stays the same.",
    "",
    product,
    APP_TAGLINE,
  ].join("\n");
}

export function planPasswordReset(input: {
  emailValid: boolean;
  mailConfigured: boolean;
  rateLimited: boolean;
  accountExists: boolean;
  loginAllowed: boolean;
}): { error: string; message: string; send: boolean } {
  if (!input.emailValid) return { error: "Enter a valid email.", message: "", send: false };
  if (!input.mailConfigured) return { error: "", message: RESET_MAIL_OFF, send: false };
  const send = !input.rateLimited && input.accountExists && input.loginAllowed;
  return { error: "", message: RESET_NEUTRAL, send };
}

/** True when this email or IP is over the hour window. Records the attempt either way. */
export function takeResetSlot(
  email: string,
  ip: string,
  now: number,
  store: Map<string, number[]> = hits,
): boolean {
  const emailBlocked = note(store, `email:${email}`, now, RESET_EMAIL_LIMIT);
  const ipBlocked = note(store, `ip:${ip || "unknown"}`, now, RESET_IP_LIMIT);
  return emailBlocked || ipBlocked;
}

function note(store: Map<string, number[]>, key: string, now: number, limit: number): boolean {
  const start = now - RESET_WINDOW_MS;
  const prev = (store.get(key) ?? []).filter((stamp) => stamp >= start && stamp <= now);
  prev.push(now);
  store.set(key, prev);
  return prev.length > limit;
}

export async function issueResetToken(userId: string, now: Date): Promise<string | null> {
  const since = new Date(now.getTime() - RESET_WINDOW_MS);
  const recent = await prisma.passwordResetToken.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recent >= RESET_EMAIL_LIMIT) return null;
  const raw = newResetToken();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashResetToken(raw),
        expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      },
    }),
  ]);
  return raw;
}

export async function consumeResetToken(
  rawToken: string,
  password: string,
  now: Date,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const token = rawToken.trim();
  if (token.length < 20 || password.length < 8 || password.length > 72) {
    return { ok: false, error: RESET_LINK_INVALID };
  }
  const tokenHash = hashResetToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { email: true } },
    },
  });
  if (!row || !tokenUsable(row, now) || !passwordLoginAllowed(row.user.email, process.env)) {
    return { ok: false, error: RESET_LINK_INVALID };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return { ok: false, error: RESET_LINK_INVALID };
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash, passwordChangedAt: now },
  });
  return { ok: true, email: row.user.email };
}
