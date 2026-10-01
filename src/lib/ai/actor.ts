import { createHmac } from "node:crypto";

const VISITOR = /^[A-Za-z0-9_-]{16,80}$/;

/** HMAC of the visitor cookie. The raw id is not stored. */
export function visitorActorHash(visitorId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!VISITOR.test(visitorId)) return null;
  const salt = env.STATS_SALT?.trim() || env.AUTH_SECRET?.trim() || "";
  if (salt.length < 16) return null;
  return createHmac("sha256", salt).update(`ai:${visitorId}`).digest("hex");
}
