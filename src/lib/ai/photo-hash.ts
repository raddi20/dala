import { createHmac } from "node:crypto";

/** HMAC of the photo bytes. The image itself is not stored. A short or missing secret skips fingerprinting. */
export function photoFingerprint(bytes: Uint8Array, secret: string): string | null {
  const key = secret.trim();
  if (key.length < 16) return null;
  return createHmac("sha256", key).update(bytes).digest("hex");
}

export function photoHashSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.MOD_PHOTO_HASH?.trim() ?? "";
}
