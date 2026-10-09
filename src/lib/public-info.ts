import { chargeFor, FEATURED_DAYS, PRO_DAYS, type PaidProduct } from "@/lib/constants";

/**
 * Public info pages. Edit the date and the legal name here.
 * The routes, the footer, and the sitemap all read this list.
 */

/** Visible on each page. Change this when the copy changes. */
export const PUBLIC_PAGES_UPDATED = {
  label: "9 October 2026",
  iso: "2026-10-09",
} as const;

/**
 * Controller name. Terms, Privacy, Contact, Refund, and the other public legal lines
 * read this constant. It is the only copy of the name.
 * Change it to the registered BRS name (for example "Rangach" while that business
 * name is owned by the proprietor, or a limited-company name after incorporation).
 */
export const LEGAL_ENTITY_NAME = "Rangach Ltd";

/**
 * Company or business-name registration number. Leave this empty until it exists.
 * Pages show "(company no. X)" only once LEGAL_ENTITY_REG_NO is filled in.
 */
export const LEGAL_ENTITY_REG_NO = "";

/**
 * TODO(Kevin): proprietor name, for example Kevin Okullo.
 * Leave this empty until it should be public. An empty value is not shown.
 */
export const LEGAL_ENTITY_OWNER = "";

/** Name, plus the registration number only when LEGAL_ENTITY_REG_NO is filled in. */
export function legalEntityLabel(name = LEGAL_ENTITY_NAME, regNo = LEGAL_ENTITY_REG_NO) {
  const number = regNo.trim();
  if (!number) return name;
  return `${name} (company no. ${number})`;
}

/** "Owned by …" only when LEGAL_ENTITY_OWNER is filled in. */
export function legalEntityOwnerLine(owner = LEGAL_ENTITY_OWNER) {
  const name = owner.trim();
  if (!name) return "";
  return `Owned by ${name}.`;
}

export const CONTACT_EMAIL = "info@rangach.co.ke";

/** Display form of the business phone. An empty value is not shown on the site. */
export const BUSINESS_PHONE = "+254 729 217 350";

/** Digits for tel: links. Kept separate from the spaced display number. */
export const BUSINESS_PHONE_TEL = "+254729217350";

/** Postal address. An empty value is not shown on the site. */
export const BUSINESS_ADDRESS = "P.O. Box 46799 - 00100 Nairobi, Kenya";

/** Phone text for public pages. Empty when BUSINESS_PHONE is blank. */
export function publicBusinessPhone(value = BUSINESS_PHONE) {
  return value.trim();
}

/** Raw phone for a tel: link. Empty when BUSINESS_PHONE_TEL is blank. */
export function publicBusinessPhoneTel(value = BUSINESS_PHONE_TEL) {
  return value.trim();
}

/** Address text for public pages. Empty when BUSINESS_ADDRESS is blank. */
export function publicBusinessAddress(value = BUSINESS_ADDRESS) {
  return value.trim();
}

/** Phrase used on public pages instead of a payment-company name. */
export const LICENSED_PAYMENT_PROVIDER = "our licensed payment provider";

/** Shown on Terms, Privacy, and Refunds. Not legal advice. */
export const LEGAL_DRAFT_NOTE =
  "This page is a draft for review. It is not legal advice, and it is not a substitute for a lawyer.";

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
      "Rangach means the gate to a homestead in Dholuo. A directory of Luo-owned businesses, housing, and classifieds in Kenya, East Africa and the Diaspora.",
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
  {
    path: "/contact",
    label: "Contact",
    title: "Contact",
    description:
      "How to reach Rangach about a listing, a shop, or a Featured or Verified Pro payment. Email info@rangach.co.ke.",
  },
  {
    path: "/refund",
    label: "Refunds",
    title: "Refunds",
    description:
      "Refund and cancellation terms for Featured and Verified Pro on Rangach, including how to request a refund and how long a reply takes.",
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

/** Nairobi and Diaspora labels from the same CHARGE table checkout uses. */
export function paidPriceLine(product: PaidProduct) {
  const nairobi = chargeFor(product, "Nairobi");
  const london = chargeFor(product, "London");
  return `${nairobi.label} for shops in Kenya and East Africa and ${london.label} for Diaspora shops`;
}
