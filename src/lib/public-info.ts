import { chargeFor, FEATURED_DAYS, type PaidProduct } from "@/lib/constants";

/**
 * Public info pages. Edit the date and the legal name here.
 * The four routes, the footer, and the sitemap all read this list.
 */

/** Visible on each page. Change this when the copy changes. */
export const PUBLIC_PAGES_UPDATED = {
  label: "6 October 2026",
  iso: "2026-10-06",
} as const;

/**
 * Controller name. Shown on the Terms and Privacy pages.
 * Keep the name in this one constant.
 */
export const LEGAL_ENTITY_NAME = "Rangach Ltd";

/**
 * Company registration number. Leave this empty until incorporation.
 * Terms and Privacy show "Rangach Ltd (company no. X)" only once it is set.
 */
export const LEGAL_ENTITY_REG_NO = "";

/** Name, plus the registration number only when LEGAL_ENTITY_REG_NO is filled in. */
export function legalEntityLabel(name = LEGAL_ENTITY_NAME, regNo = LEGAL_ENTITY_REG_NO) {
  const number = regNo.trim();
  if (!number) return name;
  return `${name} (company no. ${number})`;
}

export const CONTACT_EMAIL = "info@rangach.co.ke";

/**
 * How many days a Verified Pro payment lasts.
 *
 * Checkout on this branch sets the Pro flag and does not store an end date,
 * so this stays null and the pages use the wording that is still true if Pro
 * becomes a renewable day-count. Set a positive whole number here when checkout
 * starts that clock. Do not hardcode the number in the page copy.
 */
export const VERIFIED_PRO_DAYS: number | null = null;

export const PUBLIC_INFO_PAGES = [
  {
    path: "/about",
    label: "About",
    title: "About",
    description:
      "Rangach means the gate to a homestead in Dholuo. A directory of Luo-owned businesses, housing, and classifieds in Nairobi and London.",
  },
  {
    path: "/faq",
    label: "FAQ",
    title: "FAQ",
    description:
      "How the free shop, Featured, and Verified Pro work, plus verification badges, shop videos, buying for family back home, and reporting a listing.",
  },
  {
    path: "/terms",
    label: "Terms",
    title: "Terms",
    description:
      "Terms for using Rangach: accurate listings, photos and videos, paid upgrades, and deals that stay between buyers and sellers.",
  },
  {
    path: "/privacy",
    label: "Privacy",
    title: "Privacy",
    description:
      "How Rangach handles personal data under the Kenya Data Protection Act 2019 and the UK GDPR, including what we collect and who processes it.",
  },
] as const;

export type PublicInfoPath = (typeof PUBLIC_INFO_PAGES)[number]["path"];

export function publicInfoPage(path: PublicInfoPath) {
  const page = PUBLIC_INFO_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`Unknown public info page: ${path}`);
  return page;
}

export function isPublicInfoPath(path: string) {
  return PUBLIC_INFO_PAGES.some((page) => page.path === path);
}

export function publicPagesUpdatedAt() {
  return new Date(`${PUBLIC_PAGES_UPDATED.iso}T00:00:00.000Z`);
}

function isDayCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Day count when configured. Null means checkout does not set a Pro end date. */
export function verifiedProDayCount(): number | null {
  return isDayCount(VERIFIED_PRO_DAYS) ? VERIFIED_PRO_DAYS : null;
}

/**
 * Pro length for the public pages.
 * With no day count, the sentence stays true whether Pro is an open plan or a
 * later renewable period. With a day count, it states that period.
 */
export function verifiedProDurationCopy(days: number | null = verifiedProDayCount()) {
  if (days) {
    return `Verified Pro is a paid plan, not a verification badge. It lasts ${days} days from the payment. A new payment starts another ${days} days.`;
  }
  return "Verified Pro is a paid plan, not a verification badge. How long it lasts is the period checkout applies when you pay. If the plan is open-ended, it stays on until Rangach turns it off. If it is sold for a set number of days, you get that many days, and a new payment can start another period of the same length.";
}

export function featuredDurationCopy() {
  return `Featured lasts ${FEATURED_DAYS} days from the payment. A new payment starts another ${FEATURED_DAYS} days from that payment.`;
}

/** Nairobi and London labels from the same CHARGE table checkout uses. */
export function paidPriceLine(product: PaidProduct) {
  const nairobi = chargeFor(product, "Nairobi");
  const london = chargeFor(product, "London");
  return `${nairobi.label} in Nairobi and ${london.label} in London`;
}
