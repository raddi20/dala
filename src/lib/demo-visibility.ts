import type { Prisma } from "@prisma/client";
import { DEMO_EMAIL_DOMAIN, isDemoEmail } from "@/lib/admin-access";

/**
 * Seeded shops and listings belong to @dala.local accounts in prisma/seed.ts.
 * That email domain is the marker. There is no separate flag column.
 * The rows stay in the database. SHOW_DEMO_SHOPS only controls public pages.
 * Unset, empty, or any other value hides them.
 */
type DemoEnv = Record<string, string | undefined>;

export function showDemoShops(env?: DemoEnv): boolean {
  const raw = ((env ?? process.env).SHOW_DEMO_SHOPS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** True when this account is demo data and public pages must hide it. */
export function isPublicDemoHidden(email: string | null | undefined, env?: DemoEnv): boolean {
  if (showDemoShops(env) || !email) return false;
  return isDemoEmail(email);
}

/** Prisma user filter that drops @dala.local. Null when demo rows are public. */
export function hiddenDemoUserFilter(env?: DemoEnv): Prisma.UserWhereInput | null {
  if (showDemoShops(env)) return null;
  return { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } };
}

export function publicListingWhere(extra: Prisma.ListingWhereInput = {}, env?: DemoEnv): Prisma.ListingWhereInput {
  const demo = hiddenDemoUserFilter(env);
  if (!demo) return extra;
  return { AND: [extra, { owner: demo }] };
}

export function publicShopWhere(extra: Prisma.StorefrontWhereInput = {}, env?: DemoEnv): Prisma.StorefrontWhereInput {
  const demo = hiddenDemoUserFilter(env);
  if (!demo) return extra;
  return { AND: [extra, { user: demo }] };
}

/**
 * The build seeds only when the user table is empty, then never touches those rows again.
 * A later deploy must not insert them a second time or flip them back to public.
 */
export function shouldLoadDemoSeed(userCount: number): boolean {
  return userCount === 0;
}
