/**
 * Phone and WhatsApp numbers stored on an account or a listing.
 * Kenya (Nairobi and any other city) and the UK (London) only.
 * Saved values are E.164: +254712345678 or +447123456789.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

export type PhoneCountry = "KE" | "GB";

export const PHONE_HINT = "0712 345 678, +254 712 345 678, or a UK 07123 456789.";

const KE_EXAMPLE = "A Kenyan mobile looks like 0712 345 678.";
const UK_EXAMPLE = "A UK number looks like 07123 456789.";
const TOO_MANY = `That number has too many digits. ${KE_EXAMPLE}`;
const TOO_SHORT = `That number is too short. ${KE_EXAMPLE}`;
const DIGITS_ONLY = "Use digits only, like 0712 345 678.";

const FORMATTING = /[\s.\-()\u00a0]/g;
const LENGTHS = [13, 12, 11, 10, 9];

export function countryForCity(city: string): PhoneCountry {
  return city.trim().toLowerCase() === "london" ? "GB" : "KE";
}

export type ParsedPhone = { ok: true; e164: string } | { ok: false; error: string };

/** One typed number, already split out of a field that may contain two. */
export function parsePhone(raw: string, country: PhoneCountry = "KE"): ParsedPhone {
  const trimmed = raw.trim().replace(/^tel:/i, "").trim();
  if (!trimmed) return { ok: false, error: "Enter a phone number." };
  if (/[a-z]/i.test(trimmed)) return { ok: false, error: DIGITS_ONLY };

  const compact = trimmed.replace(FORMATTING, "").replace(/,/g, "");
  if (!/^\+?\d+$/.test(compact)) return { ok: false, error: DIGITS_ONLY };

  const digits = compact.replace(/\D/g, "");
  const hasPlus = compact.startsWith("+");
  if (!hasPlus && digits.startsWith("00") && digits.length > 4) {
    return parsePhone(`+${digits.slice(2)}`, country);
  }

  if (hasPlus || digits.startsWith("254") || digits.startsWith("44")) {
    if (digits.startsWith("254")) {
      const kenya = kenyaFromDigits(digits);
      if (kenya) return { ok: true, e164: kenya };
      return { ok: false, error: digits.length > 12 ? TOO_MANY : digits.length < 12 ? TOO_SHORT : `Enter a Kenyan mobile like 0712 345 678.` };
    }
    if (digits.startsWith("44")) {
      const uk = ukFromDigits(digits);
      if (uk) return { ok: true, e164: uk };
      if (digits.length > 13) return { ok: false, error: `That number has too many digits. ${UK_EXAMPLE}` };
      if (digits.length < 12) return { ok: false, error: `That number is too short. ${UK_EXAMPLE}` };
      return { ok: false, error: `Enter a UK number like 07123 456789.` };
    }
  }

  const kenya = kenyaFromDigits(digits);
  const uk = ukFromDigits(digits);
  if (kenya && !uk) return { ok: true, e164: kenya };
  if (uk && !kenya) return { ok: true, e164: uk };
  if (kenya && uk) return { ok: true, e164: country === "GB" ? uk : kenya };

  if (digits.length > 11) return { ok: false, error: TOO_MANY };
  if (digits.length > 0 && digits.length < 9) return { ok: false, error: TOO_SHORT };
  if (country === "GB") {
    return { ok: false, error: "Enter a UK number like 07123 456789, or a Kenyan mobile like 0712 345 678." };
  }
  return { ok: false, error: "Enter a Kenyan mobile like 0712 345 678, or a UK number like 07123 456789." };
}

function kenyaFromDigits(digits: string): string | null {
  if (/^2540[17]\d{8}$/.test(digits)) return `+254${digits.slice(4)}`;
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  return null;
}

function ukFromDigits(digits: string): string | null {
  if (/^440[1-9]\d{9}$/.test(digits)) return `+44${digits.slice(3)}`;
  if (/^44[1-9]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0[1-9]\d{9}$/.test(digits)) return `+44${digits.slice(1)}`;
  if (/^[1-9]\d{9}$/.test(digits)) return `+44${digits}`;
  return null;
}

/** Split a field that has two numbers. A single formatted number stays as one piece. */
export function splitPhoneInput(raw: string): string[] {
  const text = raw.trim().replace(/^tel:/i, "").trim();
  if (!text) return [];

  const plusCount = (text.match(/\+/g) ?? []).length;
  const hasBreak = /[/;|\n\r]/.test(text) || /\b(?:or|and)\b/i.test(text) || plusCount > 1;
  if (hasBreak) {
    const normalised = text.replace(/\s+\b(?:or|and)\b\s+/gi, " / ");
    return normalised
      .split(/\s*(?:\/|;|\||\n|\r)+\s*|(?<=\d)\s*(?=\+)/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (text.includes(",")) {
    const sides = text.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
    if (sides.length >= 2 && sides.every((side) => side.replace(/\D/g, "").length >= 9)) return sides;
  }

  const chunks = text.split(/\s+/).filter(Boolean);
  if (chunks.length >= 2 && chunks.every((chunk) => chunk.replace(/\D/g, "").length >= 9)) return chunks;

  if (parsePhone(text, "KE").ok || parsePhone(text, "GB").ok) return [text];

  const jammed = splitJammed(text.replace(/\D/g, ""));
  if (jammed) return jammed;
  return [text];
}

function scoreDigits(digits: string) {
  if (digits.startsWith("254") || digits.startsWith("44")) return 5;
  if (digits.startsWith("0")) return 3;
  return 1;
}

function splitJammed(digits: string): [string, string] | null {
  if (digits.length < 18 || digits.length > 26) return null;
  let best: { left: string; right: string; score: number } | null = null;
  for (const leftLen of LENGTHS) {
    const rightLen = digits.length - leftLen;
    if (!LENGTHS.includes(rightLen)) continue;
    const left = digits.slice(0, leftLen);
    const right = digits.slice(leftLen);
    if (!parsePhone(left, "KE").ok || !parsePhone(right, "KE").ok) continue;
    const score = scoreDigits(left) + scoreDigits(right);
    if (!best || score > best.score) best = { left, right, score };
  }
  return best ? [best.left, best.right] : null;
}

export type PhoneField = "phone" | "whatsapp";

export type PhoneReport = { field: PhoneField; message: string };

export type ContactPlan = {
  phone: string;
  whatsapp: string;
  changed: boolean;
  reports: PhoneReport[];
};

type FieldRead = { ok: true; values: string[] } | { ok: false; error: string };

function readField(raw: string, country: PhoneCountry): FieldRead {
  const parts = splitPhoneInput(raw);
  if (parts.length === 0) return { ok: true, values: [] };
  const values: string[] = [];
  for (const part of parts) {
    const parsed = parsePhone(part, country);
    if (!parsed.ok) return parsed;
    if (!values.includes(parsed.e164)) values.push(parsed.e164);
  }
  return { ok: true, values };
}

/**
 * Normalise a phone field and its partner (WhatsApp, or the other way round).
 * The first number stays in the field it was typed in.
 * A second number moves to the partner when that partner is empty.
 * A second number that does not fit is reported and not written over the partner.
 * A number that cannot be read is left as it was and reported.
 */
export function planContactValues(input: { phone: string; whatsapp: string; city: string }): ContactPlan {
  const country = countryForCity(input.city);
  const beforePhone = input.phone.trim();
  const beforeWhatsapp = input.whatsapp.trim();
  const phoneRead = readField(beforePhone, country);
  const whatsappRead = readField(beforeWhatsapp, country);
  const reports: PhoneReport[] = [];

  if (!phoneRead.ok) reports.push({ field: "phone", message: phoneRead.error });
  if (!whatsappRead.ok) reports.push({ field: "whatsapp", message: whatsappRead.error });

  let phone = phoneRead.ok ? (phoneRead.values[0] ?? "") : beforePhone;
  let whatsapp = whatsappRead.ok ? (whatsappRead.values[0] ?? "") : beforeWhatsapp;

  const extras: Array<{ field: PhoneField; value: string }> = [];
  if (phoneRead.ok) {
    for (const value of phoneRead.values.slice(1)) extras.push({ field: "phone", value });
  }
  if (whatsappRead.ok) {
    for (const value of whatsappRead.values.slice(1)) extras.push({ field: "whatsapp", value });
  }

  for (const extra of extras) {
    if (extra.field === "phone" && !whatsapp) {
      whatsapp = extra.value;
      continue;
    }
    if (extra.field === "whatsapp" && !phone) {
      phone = extra.value;
      continue;
    }
    if (phone === extra.value || whatsapp === extra.value) continue;
    const label = extra.field === "phone" ? "Phone" : "WhatsApp";
    reports.push({
      field: extra.field,
      message: `${label} has two numbers. ${extra.value} was not saved, because the other number field already has one. Put each number in its own field.`,
    });
  }

  return {
    phone,
    whatsapp,
    changed: phone !== beforePhone || whatsapp !== beforeWhatsapp,
    reports,
  };
}

/** Form save. A bad number or a second number that does not fit is an error, and nothing is saved. */
export function normalizeContactPair(input: { phone: string; whatsapp: string; city: string }):
  | { ok: true; phone: string; whatsapp: string }
  | { ok: false; error: string; field: PhoneField } {
  const plan = planContactValues(input);
  const problem = plan.reports[0];
  if (problem) return { ok: false, error: problem.message, field: problem.field };
  return { ok: true, phone: plan.phone, whatsapp: plan.whatsapp };
}

/**
 * E.164 already stored, spaces allowed. Local 07… numbers are not accepted here,
 * so a link is never built from a value that has not been normalised.
 */
export function canonicalE164(value: string): string {
  const compact = value.trim().replace(FORMATTING, "");
  if (!compact.startsWith("+")) return "";
  const parsed = parsePhone(compact, compact.startsWith("+44") ? "GB" : "KE");
  if (!parsed.ok || parsed.e164 !== compact) return "";
  return parsed.e164;
}

/** Digits for wa.me. Empty when the value is not already E.164. */
export function waMeDigits(value: string): string {
  const e164 = canonicalE164(value);
  return e164.startsWith("+") ? e164.slice(1) : "";
}

/** tel:+E164, or empty when the value is not already E.164. */
export function telHref(value: string): string {
  const e164 = canonicalE164(value);
  return e164 ? `tel:${e164}` : "";
}

export type PhoneRowKind = "user" | "listing";

export type PhoneRow = {
  kind: PhoneRowKind;
  id: string;
  city: string;
  phone: string;
  whatsapp: string;
  /** Account name or listing title. Display only. */
  label?: string;
};

export type PhoneRowPlan = ContactPlan & {
  kind: PhoneRowKind;
  id: string;
  city: string;
  label: string;
  beforePhone: string;
  beforeWhatsapp: string;
};

export function planPhoneRow(row: PhoneRow): PhoneRowPlan {
  const plan = planContactValues({ phone: row.phone, whatsapp: row.whatsapp, city: row.city });
  return {
    ...plan,
    kind: row.kind,
    id: row.id,
    city: row.city.trim() || "Nairobi",
    label: row.label?.trim() ?? "",
    beforePhone: row.phone.trim(),
    beforeWhatsapp: row.whatsapp.trim(),
  };
}

export type PhoneFieldDiff = {
  kind: PhoneRowKind;
  id: string;
  city: string;
  label: string;
  record: string;
  field: "phone" | "whatsapp" | "contactPhone" | "contactWhatsapp";
  current: string;
  proposed: string;
  /** True when this field would be saved as E.164. */
  fixable: boolean;
  /** Set when a person still has to fix this field. The stored value is not overwritten for that reason. */
  manualReason: string;
};

export function phoneRecordLabel(plan: Pick<PhoneRowPlan, "kind" | "id" | "city" | "label">): string {
  const kind = plan.kind === "listing" ? "Listing" : "User";
  const name = plan.label ? ` ${plan.label}` : "";
  return `${kind}${name} ${plan.id} (${plan.city})`;
}

/** Fields that would change, plus fields that stay put because they could not be read. */
export function phoneFieldDiffs(plan: PhoneRowPlan): PhoneFieldDiff[] {
  const specs: Array<{ field: PhoneField; before: string; after: string }> = [
    { field: "phone", before: plan.beforePhone, after: plan.phone },
    { field: "whatsapp", before: plan.beforeWhatsapp, after: plan.whatsapp },
  ];
  const diffs: PhoneFieldDiff[] = [];
  for (const spec of specs) {
    const manualReason = plan.reports
      .filter((report) => report.field === spec.field)
      .map((report) => report.message)
      .join(" ");
    const fixable = spec.after !== spec.before;
    if (!fixable && !manualReason) continue;
    diffs.push({
      kind: plan.kind,
      id: plan.id,
      city: plan.city,
      label: plan.label,
      record: phoneRecordLabel(plan),
      field: plan.kind === "listing" ? (spec.field === "phone" ? "contactPhone" : "contactWhatsapp") : spec.field,
      current: spec.before,
      proposed: spec.after,
      fixable,
      manualReason,
    });
  }
  return diffs;
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function showValue(value: string) {
  return value.trim() ? value : "(empty)";
}

/** Before/after lines for the rows that will be written, then anything left for a person. */
export function phoneAuditReason(plans: PhoneRowPlan[]): string {
  const written = plans.filter((plan) => plan.changed);
  const lines = [`Updated ${plural(written.length, "row")}.`];
  for (const plan of written) {
    for (const diff of phoneFieldDiffs(plan)) {
      if (!diff.fixable) continue;
      lines.push(`${diff.record} ${diff.field}: ${showValue(diff.current)} → ${showValue(diff.proposed)}`);
    }
  }
  const flagged = plans.flatMap(phoneFieldDiffs).filter((diff) => diff.manualReason);
  if (flagged.length > 0) {
    lines.push("Left for a manual fix:");
    for (const diff of flagged) {
      lines.push(`${diff.record} ${diff.field}: ${showValue(diff.current)} — ${diff.manualReason}`);
    }
  }
  return lines.join("\n");
}

export function formatPhoneRow(plan: PhoneRowPlan): string {
  const phoneLabel = plan.kind === "listing" ? "contactPhone" : "phone";
  const whatsappLabel = plan.kind === "listing" ? "contactWhatsapp" : "whatsapp";
  const kind = plan.kind === "listing" ? "Listing" : "User";
  const lines = [`${kind} ${plan.id} (${plan.city})`];
  const phoneReported = plan.reports.some((report) => report.field === "phone");
  const whatsappReported = plan.reports.some((report) => report.field === "whatsapp");
  if (plan.phone !== plan.beforePhone || phoneReported) {
    const after = plan.phone === plan.beforePhone ? "(unchanged)" : showValue(plan.phone);
    lines.push(`  ${phoneLabel}: ${showValue(plan.beforePhone)} → ${after}`);
  }
  if (plan.whatsapp !== plan.beforeWhatsapp || whatsappReported) {
    const after = plan.whatsapp === plan.beforeWhatsapp ? "(unchanged)" : showValue(plan.whatsapp);
    lines.push(`  ${whatsappLabel}: ${showValue(plan.beforeWhatsapp)} → ${after}`);
  }
  for (const report of plan.reports) lines.push(`  report: ${report.message}`);
  return lines.join("\n");
}

export function renderPhoneReport(plans: PhoneRowPlan[], apply: boolean): string {
  const lines = [
    apply
      ? "APPLY. The rows below were written."
      : "DRY RUN. No rows were written. Run again with --apply to update.",
    "",
  ];
  const interesting = plans.filter((plan) => plan.changed || plan.reports.length > 0);
  if (interesting.length === 0) {
    lines.push("No phone numbers need updating.");
    lines.push("");
  }
  for (const plan of interesting) {
    lines.push(formatPhoneRow(plan));
    lines.push("");
  }
  const updates = plans.filter((plan) => plan.changed).length;
  const reported = plans.filter((plan) => plan.reports.length > 0).length;
  const fine = plans.length - interesting.length;
  const verb = apply ? "Updated" : "Would update";
  lines.push(`${verb} ${plural(updates, "row")}. ${plural(reported, "row")} reported. ${plural(fine, "row")} already fine.`);
  return lines.join("\n");
}

/** Writes only rows that change. A dry run writes nothing. A second apply is a no-op. */
export async function commitPhonePlans(
  plans: PhoneRowPlan[],
  apply: boolean,
  write: (plan: PhoneRowPlan) => Promise<void>,
): Promise<number> {
  if (!apply) return 0;
  let written = 0;
  for (const plan of plans) {
    if (!plan.changed) continue;
    await write(plan);
    written += 1;
  }
  return written;
}

type PhoneDb = PrismaClient | Prisma.TransactionClient;

/** User and listing phone fields. Shop pages use the account numbers. */
export async function readPhoneRows(db: PhoneDb): Promise<PhoneRow[]> {
  const [users, listings] = await Promise.all([
    db.user.findMany({ select: { id: true, city: true, phone: true, whatsapp: true, name: true } }),
    db.listing.findMany({
      select: { id: true, city: true, contactPhone: true, contactWhatsapp: true, title: true },
    }),
  ]);
  return [
    ...users.map((user) => ({
      kind: "user" as const,
      id: user.id,
      city: user.city,
      phone: user.phone,
      whatsapp: user.whatsapp,
      label: user.name.trim(),
    })),
    ...listings.map((listing) => ({
      kind: "listing" as const,
      id: listing.id,
      city: listing.city,
      phone: listing.contactPhone,
      whatsapp: listing.contactWhatsapp,
      label: listing.title.trim(),
    })),
  ];
}

/** Writes one planned row. A number that could not be read is not passed here. */
export async function writePhonePlan(db: PhoneDb, plan: PhoneRowPlan): Promise<void> {
  if (plan.kind === "user") {
    await db.user.update({ where: { id: plan.id }, data: { phone: plan.phone, whatsapp: plan.whatsapp } });
    return;
  }
  await db.listing.update({
    where: { id: plan.id },
    data: { contactPhone: plan.phone, contactWhatsapp: plan.whatsapp },
  });
}
