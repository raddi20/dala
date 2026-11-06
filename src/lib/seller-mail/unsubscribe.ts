import { createHmac } from "node:crypto";

export function visibilityUnsubscribeToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`visibility:${userId}`).digest("hex");
}

export function visibilityUnsubscribeUrl(origin: string, userId: string, secret: string): string {
  const token = visibilityUnsubscribeToken(userId, secret);
  return `${origin.replace(/\/$/, "")}/api/seller/visibility-unsubscribe?user=${encodeURIComponent(userId)}&token=${token}`;
}
