import { appName } from "@/lib/brand";
import { whatsappPrefillLink } from "@/lib/whatsapp";

export const FAMILY_PAYERS = [
  { value: "me", label: "I am paying", line: "I am paying." },
  { value: "recipient", label: "The recipient is paying", line: "The recipient will pay." },
  { value: "other", label: "Someone else is paying", line: "Someone else is paying." },
] as const;

export type FamilyPayer = (typeof FAMILY_PAYERS)[number]["value"];

export type FamilyOrderInput = {
  subjectName: string;
  url: string;
  siteName?: string;
  recipientName?: string;
  town?: string;
  dateNeeded?: string;
  payer?: string;
};

function clean(value: string | undefined, max: number) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

/** Calendar date from a YYYY-MM-DD field, or blank when the day is not real. */
export function formatFamilyDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return "";
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateLine(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatFamilyDate(raw);
  return clean(raw, 40);
}

/**
 * Polite WhatsApp draft for someone buying for family at home.
 * The shop or listing name and link are enough. The form fields are optional.
 */
export function familyOrderMessage(input: FamilyOrderInput) {
  const site = clean(input.siteName, 40) || appName();
  const name = clean(input.subjectName, 120) || "this listing";
  const url = clean(input.url, 300);
  const recipient = clean(input.recipientName, 80);
  const town = clean(input.town, 80);
  const needed = dateLine(input.dateNeeded);
  const payer = FAMILY_PAYERS.find((item) => item.value === clean(input.payer, 20));

  const lines = [`Hello, I found ${name} on ${site}${url ? ` (${url})` : ""}.`, "", "I am buying for family back home."];
  if (recipient) lines.push(`Recipient: ${recipient}`);
  if (town) lines.push(`Town or area: ${town}`);
  if (needed) lines.push(`Needed by: ${needed}`);
  if (payer) lines.push(`Who is paying: ${payer.line}`);
  lines.push("", "Please let me know if you can help. Thank you.");
  return lines.join("\n");
}

export function familyOrderWhatsappLink(phone: string, input: FamilyOrderInput) {
  return whatsappPrefillLink(phone, familyOrderMessage(input));
}
