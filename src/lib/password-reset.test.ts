import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import bcrypt from "bcryptjs";
import { LoginForm } from "@/components/auth-forms";
import { prisma } from "@/lib/prisma";
import {
  RESET_EMAIL_LIMIT,
  RESET_IP_LIMIT,
  RESET_LINK_INVALID,
  RESET_MAIL_OFF,
  RESET_NEUTRAL,
  consumeResetToken,
  hashResetToken,
  issueResetToken,
  newResetToken,
  planPasswordReset,
  resetEmailText,
  sessionStale,
  takeResetSlot,
  tokenUsable,
} from "@/lib/password-reset";

test("reset tokens are high entropy and stored as a sha256 hash", () => {
  const raw = newResetToken();
  const hash = hashResetToken(raw);
  assert.equal(raw.length >= 40, true);
  assert.notEqual(hash, raw);
  assert.equal(hash, createHash("sha256").update(raw).digest("hex"));
  assert.equal(hashResetToken(raw), hash);
});

test("a token is unusable after it expires or is used", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");
  const fresh = { usedAt: null, expiresAt: new Date(now.getTime() + 60_000) };
  const expired = { usedAt: null, expiresAt: new Date(now.getTime() - 1) };
  const used = { usedAt: now, expiresAt: new Date(now.getTime() + 60_000) };
  assert.equal(tokenUsable(fresh, now), true);
  assert.equal(tokenUsable(expired, now), false);
  assert.equal(tokenUsable(used, now), false);
});

test("the public reply does not say whether the email exists", () => {
  const known = planPasswordReset({
    emailValid: true,
    mailConfigured: true,
    rateLimited: false,
    accountExists: true,
    loginAllowed: true,
  });
  const unknown = planPasswordReset({
    emailValid: true,
    mailConfigured: true,
    rateLimited: false,
    accountExists: false,
    loginAllowed: false,
  });
  const limited = planPasswordReset({
    emailValid: true,
    mailConfigured: true,
    rateLimited: true,
    accountExists: true,
    loginAllowed: true,
  });
  const mailOff = planPasswordReset({
    emailValid: true,
    mailConfigured: false,
    rateLimited: false,
    accountExists: true,
    loginAllowed: true,
  });
  const mailOffUnknown = planPasswordReset({
    emailValid: true,
    mailConfigured: false,
    rateLimited: false,
    accountExists: false,
    loginAllowed: false,
  });
  assert.equal(known.message, RESET_NEUTRAL);
  assert.equal(unknown.message, known.message);
  assert.equal(limited.message, known.message);
  assert.equal(known.send, true);
  assert.equal(unknown.send, false);
  assert.equal(limited.send, false);
  assert.equal(mailOff.message, RESET_MAIL_OFF);
  assert.equal(mailOffUnknown.message, mailOff.message);
  assert.equal(mailOff.send, false);
});

test("reset requests are limited by email and by IP", () => {
  const store = new Map<string, number[]>();
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);
  for (let i = 0; i < RESET_EMAIL_LIMIT; i += 1) {
    assert.equal(takeResetSlot("amina@example.com", "203.0.113.5", now + i, store), false);
  }
  assert.equal(takeResetSlot("amina@example.com", "203.0.113.9", now + 10, store), true);
  assert.equal(takeResetSlot("other@example.com", "203.0.113.5", now + 11, store), false);
  for (let i = 0; i < RESET_IP_LIMIT; i += 1) {
    assert.equal(takeResetSlot(`person-${i}@example.com`, "198.51.100.8", now + 20 + i, store), false);
  }
  assert.equal(takeResetSlot("fresh@example.com", "198.51.100.8", now + 50, store), true);
});

test("a password change makes older sessions stale and leaves a new sign-in", () => {
  const changed = new Date("2026-10-09T12:00:00.000Z");
  assert.equal(sessionStale(0, null), false);
  assert.equal(sessionStale(0, changed), true);
  assert.equal(sessionStale(changed.getTime(), changed), false);
  assert.equal(sessionStale(changed.getTime() - 1, changed), true);
});

test("the reset email is short and carries the site link", () => {
  const link = "https://www.rangach.co.ke/reset-password?token=abc123";
  const text = resetEmailText("Amina", link);
  assert.match(text, /^Hello Amina,/);
  assert.ok(text.includes(link));
  assert.match(text, /works once/);
  assert.match(text, /45 minutes/);
  assert.match(text, /The gateway to the Luo home/);
  assert.equal(text.includes("passwordHash"), false);
});

test("the sign-in form links to forgot password", () => {
  const html = renderToStaticMarkup(createElement(LoginForm, { nextPath: "/account", queryError: "" }));
  assert.match(html, /href="\/forgot-password"/);
  assert.match(html, /Forgot password\?/);
});

async function userWithPassword(password: string) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const passwordHash = await bcrypt.hash(password, 4);
  return prisma.user.create({
    data: {
      email: `reset-${stamp}@example.com`,
      name: "Amina",
      passwordHash,
    },
  });
}

test("a reset updates the password, then a second use and an older token fail", async () => {
  const user = await userWithPassword("old-password-1");
  const now = new Date("2026-10-09T12:00:00.000Z");
  try {
    const first = await issueResetToken(user.id, now);
    const second = await issueResetToken(user.id, new Date(now.getTime() + 1000));
    assert.ok(first);
    assert.ok(second);
    const stored = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    assert.equal(stored.some((row) => row.tokenHash === first), false);
    assert.equal(stored.some((row) => row.tokenHash === hashResetToken(second)), true);

    const stale = await consumeResetToken(first, "new-password-1", new Date(now.getTime() + 2000));
    assert.equal(stale.ok, false);

    const saved = await consumeResetToken(second, "new-password-1", new Date(now.getTime() + 2000));
    assert.equal(saved.ok, true);
    if (saved.ok) assert.equal(saved.email, user.email);

    const again = await consumeResetToken(second, "another-password", new Date(now.getTime() + 3000));
    assert.deepEqual(again, { ok: false, error: RESET_LINK_INVALID });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(await bcrypt.compare("new-password-1", updated.passwordHash), true);
    assert.equal(await bcrypt.compare("old-password-1", updated.passwordHash), false);
    assert.equal(updated.passwordChangedAt?.toISOString(), new Date(now.getTime() + 2000).toISOString());
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("an expired reset link does not change the password", async () => {
  const user = await userWithPassword("old-password-2");
  const now = new Date("2026-10-09T12:00:00.000Z");
  try {
    const token = await issueResetToken(user.id, now);
    assert.ok(token);
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(now.getTime() - 1000) },
    });
    const result = await consumeResetToken(token, "new-password-2", now);
    assert.equal(result.ok, false);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(await bcrypt.compare("old-password-2", updated.passwordHash), true);
    assert.equal(updated.passwordChangedAt, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("a sixth reset token in an hour is not issued", async () => {
  const user = await userWithPassword("old-password-3");
  const now = new Date("2026-10-09T12:00:00.000Z");
  try {
    for (let i = 0; i < RESET_EMAIL_LIMIT; i += 1) {
      const token = await issueResetToken(user.id, new Date(now.getTime() + i * 1000));
      assert.ok(token);
    }
    const blocked = await issueResetToken(user.id, new Date(now.getTime() + 10_000));
    assert.equal(blocked, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
