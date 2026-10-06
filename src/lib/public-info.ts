import { chargeFor, FEATURED_DAYS, PRO_DAYS, type PaidProduct } from "@/lib/constants";

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
 * Same constant checkout uses (PRO_DAYS). Renewing before the end date adds
 * this many days onto the current end date. Do not hardcode the number in the page copy.
 */
export const VERIFIED_PRO_DAYS: number | null = PRO_DAYS;

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

/** Day count checkout uses for one Verified Pro payment. */
export function verifiedProDayCount(): number | null {
  return isDayCount(VERIFIED_PRO_DAYS) ? VERIFIED_PRO_DAYS : null;
}

/**
 * Pro length for the public pages.
 * A payment lasts the day count. Renewing before the end date adds that many
 * days onto the current end date. A lapse hides the extra perks; it does not delete them.
 */
export function verifiedProDurationCopy(days: number | null = verifiedProDayCount()) {
  const lapse =
    "When the plan lapses, the cover, the shop video, and offerings past the free limit are hidden, not deleted, and they show again when the plan is renewed.";
  if (days) {
    return `Verified Pro is a paid plan, not a verification badge. It lasts ${days} days. Renewing before the end date adds another ${days} days to that date. ${lapse}`;
  }
  return `Verified Pro is a paid plan, not a verification badge. It lasts the period checkout applies. Renewing before the end date adds another period of the same length to that date. ${lapse}`;
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
