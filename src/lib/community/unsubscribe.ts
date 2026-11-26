import { createHmac } from "node:crypto";

export function digestUnsubscribeToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`follow-digest:${userId}`).digest("hex");
}

export function digestUnsubscribeUrl(origin: string, userId: string, secret: string): string {
  const token = digestUnsubscribeToken(userId, secret);
  return `${origin.replace(/\/$/, "")}/api/community/digest-unsubscribe?user=${encodeURIComponent(userId)}&token=${token}`;
}
