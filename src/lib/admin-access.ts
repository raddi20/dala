/**
 * Production admin is granted only by the deploy, never by the sign-up form.
 * Sign-up stores whatever email is typed and does not prove the person owns the mailbox,
 * so promoting ADMIN_EMAIL on register would let a stranger claim it first.
 */

export const DEMO_EMAIL_DOMAIN = "@dala.local";
export const ADMIN_ACCOUNT_NAME = "Rangach Admin";
export const ADMIN_ACCOUNT_CITY = "Nairobi";
export const CLAIM_SECRET_MIN = 16;
export const CLAIM_SECRET_MAX = 72;

export type AdminEnv = {
  VERCEL?: string;
  VERCEL_ENV?: string;
  ADMIN_EMAIL?: string;
  ADMIN_CLAIM_SECRET?: string;
  ADMIN_CLAIM_RESET?: string;
  [key: string]: string | undefined;
};

export type AccountRow = {
  id: string;
  email: string;
  role: string;
};

export type PlannedClaim = {
  email: string;
  userId: string | null;
  storedEmail: string | null;
  action: "create" | "claim" | "reset" | "keep" | "normalize-email";
};

export type SecurePlan = {
  /** Vercel production build. The only place that may change passwords or roles. */
  production: boolean;
  /** Production or preview. Demo password login is refused here even before the database is updated. */
  hosted: boolean;
  lockIds: string[];
  claims: PlannedClaim[];
  fatal: string | null;
  adminConfigured: boolean;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isDemoEmail(email: string): boolean {
  return normalizeEmail(email).endsWith(DEMO_EMAIL_DOMAIN);
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

/** Local `next dev` / `next start` set neither. Vercel sets VERCEL=1, including preview. */
export function isHostedDeploy(env: AdminEnv): boolean {
  return env.VERCEL === "1" || env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}

/** Database writes for lockdown and admin claim run only on the production deploy. */
export function isProductionDeploy(env: AdminEnv): boolean {
  return env.VERCEL_ENV === "production";
}

export function showDemoCredentials(env: AdminEnv): boolean {
  return !isHostedDeploy(env);
}

export function passwordLoginAllowed(email: string, env: AdminEnv): boolean {
  if (isDemoEmail(email) && isHostedDeploy(env)) return false;
  return true;
}

/** Demo accounts keep role "admin" in a local database. Hosted requests must not honor it. */
export function effectiveRole(user: { role: string; email: string }, env: AdminEnv): string {
  if (user.role === "admin" && isDemoEmail(user.email) && isHostedDeploy(env)) return "user";
  return user.role;
}

export function parseAdminEmailList(raw: string | undefined | null): { emails: string[]; invalid: string[] } {
  if (!raw?.trim()) return { emails: [], invalid: [] };
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const email = normalizeEmail(part);
    if (!email) continue;
    if (!isPlausibleEmail(email)) {
      invalid.push(email);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return { emails, invalid };
}

export function parseAdminEmails(raw: string | undefined | null): string[] {
  return parseAdminEmailList(raw).emails;
}

export function claimResetRequested(value: string | undefined | null): boolean {
  const flag = value?.trim().toLowerCase() ?? "";
  return flag === "1" || flag === "true" || flag === "yes";
}

export function claimSecretError(secret: string | undefined | null): string | null {
  const value = secret?.trim() ?? "";
  if (!value) return "ADMIN_CLAIM_SECRET is missing.";
  if (value.length < CLAIM_SECRET_MIN || value.length > CLAIM_SECRET_MAX) {
    return `ADMIN_CLAIM_SECRET must be ${CLAIM_SECRET_MIN} to ${CLAIM_SECRET_MAX} characters (got ${value.length}).`;
  }
  return null;
}

export function registrationBlockReason(email: string, env: AdminEnv): string | null {
  const normalized = normalizeEmail(email);
  if (isDemoEmail(normalized) && isHostedDeploy(env)) {
    return "Demo accounts cannot be registered on the live site.";
  }
  if (parseAdminEmails(env.ADMIN_EMAIL).includes(normalized)) {
    return "That email is reserved for the site admin and cannot be registered here.";
  }
  return null;
}

export function seedShouldSkip(userCount: number): boolean {
  return userCount > 0;
}

export function roleForSeedUser(role: string, email: string, env: AdminEnv): string {
  if (isDemoEmail(email) && isHostedDeploy(env)) return "user";
  return role;
}

export function matchUserByEmail<T extends { email: string }>(
  users: T[],
  email: string,
): { status: "none" } | { status: "one"; user: T } | { status: "ambiguous" } {
  const needle = normalizeEmail(email);
  const matches = users.filter((user) => normalizeEmail(user.email) === needle);
  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "one", user: matches[0] };
}

/**
 * Pure plan for the production build. Callers must not write to the database when `fatal` is set.
 * Preview builds return an empty plan so they cannot reset the production database.
 */
export function planSecureAccounts(users: AccountRow[], env: AdminEnv): SecurePlan {
  const production = isProductionDeploy(env);
  const hosted = isHostedDeploy(env);
  const parsed = parseAdminEmailList(env.ADMIN_EMAIL);
  const adminConfigured = parsed.emails.length > 0 || parsed.invalid.length > 0;

  if (!production) {
    return {
      production,
      hosted,
      lockIds: [],
      claims: [],
      fatal: null,
      adminConfigured,
    };
  }

  const lockIds = users.filter((user) => isDemoEmail(user.email)).map((user) => user.id);
  const projected = users.map((user) => (lockIds.includes(user.id) ? { ...user, role: "user" } : user));

  if (!adminConfigured) {
    return { production, hosted, lockIds, claims: [], fatal: null, adminConfigured: false };
  }

  if (parsed.invalid.length > 0) {
    return refused(
      production,
      hosted,
      `ADMIN_EMAIL has an unusable value (${parsed.invalid.join(", ")}). No accounts were changed.`,
    );
  }

  const secretError = claimSecretError(env.ADMIN_CLAIM_SECRET);
  if (secretError) {
    return refused(production, hosted, `${secretError} No accounts were changed.`);
  }

  const reset = claimResetRequested(env.ADMIN_CLAIM_RESET);
  const claims: PlannedClaim[] = [];
  const fatals: string[] = [];

  for (const email of parsed.emails) {
    if (isDemoEmail(email)) {
      fatals.push(`Refusing to grant admin to ${email}. Demo @dala.local accounts cannot be admin in production.`);
      continue;
    }
    const match = matchUserByEmail(projected, email);
    if (match.status === "ambiguous") {
      fatals.push(`More than one account matches ${email}. No admin change was planned for it.`);
      continue;
    }
    if (match.status === "none") {
      claims.push({ email, userId: null, storedEmail: null, action: "create" });
      continue;
    }
    const existing = match.user;
    if (reset) {
      claims.push({ email, userId: existing.id, storedEmail: existing.email, action: "reset" });
      continue;
    }
    if (existing.role === "admin") {
      claims.push({
        email,
        userId: existing.id,
        storedEmail: existing.email,
        action: existing.email === email ? "keep" : "normalize-email",
      });
      continue;
    }
    claims.push({ email, userId: existing.id, storedEmail: existing.email, action: "claim" });
  }

  if (fatals.length > 0) {
    return refused(production, hosted, `${fatals.join(" ")} No accounts were changed.`);
  }

  return {
    production,
    hosted,
    lockIds,
    claims,
    fatal: null,
    adminConfigured: true,
  };
}

function refused(production: boolean, hosted: boolean, fatal: string): SecurePlan {
  return {
    production,
    hosted,
    lockIds: [],
    claims: [],
    fatal,
    adminConfigured: true,
  };
}
