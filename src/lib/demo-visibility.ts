import type { Prisma } from "@prisma/client";
import { DEMO_EMAIL_DOMAIN, isDemoEmail } from "@/lib/admin-access";

/**
 * Seeded shops and listings belong to @dala.local accounts in prisma/seed.ts.
 * That email domain is the marker. There is no separate flag column.
 * The rows stay in the database. HIDE_DEMO_SHOPS only controls public pages.
 * Unset, empty, or any other value keeps them visible.
 */
type DemoEnv = Record<string, string | undefined>;

const ON = new Set(["1", "true", "yes", "on"]);

function flagOn(raw: string | undefined): boolean {
  return ON.has((raw ?? "").trim().toLowerCase());
}

/** True when public pages must omit seeded @dala.local shops and listings. */
export function hideDemoShops(env?: DemoEnv): boolean {
  return flagOn((env ?? process.env).HIDE_DEMO_SHOPS);
}

/** True when this account is demo data and public pages must hide it. */
export function isPublicDemoHidden(email: string | null | undefined, env?: DemoEnv): boolean {
  if (!hideDemoShops(env) || !email) return false;
  return isDemoEmail(email);
}

/**
 * Placeholder phone and WhatsApp on a demo account are never public,
 * including while HIDE_DEMO_SHOPS is off and the shop page is visible.
 */
export function isDemoContactHidden(email: string | null | undefined): boolean {
  if (!email) return false;
  return isDemoEmail(email);
}

export const DEMO_SHOP_CONTACT_NOTE = "Contact details not available for this shop";
export const DEMO_LISTING_CONTACT_NOTE = "Contact details not available for this listing";
export const DEMO_PROFILE_CONTACT_NOTE = "Contact details not available for this profile";

/** Phone and WhatsApp a public page may show. Both are blank for a demo account. */
export function publicSellerContacts(input: {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}): { hidden: boolean; phone: string; whatsapp: string } {
  if (isDemoContactHidden(input.email)) return { hidden: true, phone: "", whatsapp: "" };
  return {
    hidden: false,
    phone: (input.phone ?? "").trim(),
    whatsapp: (input.whatsapp ?? "").trim(),
  };
}

/** Drops placeholder numbers from a public description or Open Graph text. */
export function publicTextWithoutDemoNumbers(
  email: string | null | undefined,
  text: string,
  numbers: Array<string | null | undefined>,
): string {
  if (!isDemoContactHidden(email)) return text;
  let next = text;
  for (const number of numbers) {
    const raw = (number ?? "").trim();
    if (!raw) continue;
    next = next.split(raw).join("");
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 8) next = next.split(digits).join("");
  }
  return next.replace(/[ \t]{2,}/g, " ").trim();
}

/** Prisma user filter that drops @dala.local. Null when demo rows are public. */
export function hiddenDemoUserFilter(env?: DemoEnv): Prisma.UserWhereInput | null {
  if (!hideDemoShops(env)) return null;
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
