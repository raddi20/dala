import { acceptAgentCode } from "@/lib/agent-code";
import { parsePhone } from "@/lib/phone";
import {
  BUSINESS_SIGNUP_PATH,
  businessTierById,
  isBusinessTier,
  type BusinessTierId,
} from "@/lib/business-tiers";

/** Hidden field. People leave it blank. A filled value is a bot, and we do not store it. */
export const HONEYPOT_FIELD = "company_url";

export const BUSINESS_LEAD_LIMIT_MESSAGE =
  "Too many shop sign-ups from this connection. Wait an hour and try again.";

export const BUSINESS_LEAD_THANKS = "Thanks. We'll contact you about Rangach Business.";

export const LEAD_STATUSES = ["new", "contacted", "active", "declined"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const REF_CODE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const NOTES_MAX = 500;

export type LeadDraft = {
  businessName: string;
  contactName: string;
  phone: string;
  town: string;
  tier: BusinessTierId;
  notes: string;
  refCode: string;
  agentCode: string | null;
};

export type LeadFields = {
  businessName: string;
  contactName: string;
  phone: string;
  town: string;
  tier: string;
  notes: string;
  refCode: string;
  agentCode: string;
  companyUrl: string;
};

export function honeypotTripped(value: string) {
  return value.trim() !== "";
}

/** Printed-link code such as kisumu-qr. Junk becomes empty. The raw query is not stored. */
export function cleanRefCode(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return "";
  if (value.length > 40 || !REF_CODE.test(value)) return "";
  return value;
}

/** Known brochure code from the form or the rangach_agent cookie. Anything else is dropped. */
export function cleanAgentCode(
  formValue: string,
  cookieValue: string | null | undefined,
  known?: readonly string[],
): string | null {
  if (known) return acceptAgentCode(formValue, known) ?? acceptAgentCode(cookieValue, known);
  return acceptAgentCode(formValue) ?? acceptAgentCode(cookieValue);
}

export function businessInterestHref(tier: string, ref = "") {
  const params = new URLSearchParams();
  params.set("tier", businessTierById(tier)?.id ?? "starter");
  const code = cleanRefCode(ref);
  if (code) params.set("ref", code);
  return `${BUSINESS_SIGNUP_PATH}?${params.toString()}#signup`;
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function leadStatusLabel(status: string) {
  if (status === "new") return "New";
  if (status === "contacted") return "Contacted";
  if (status === "active") return "Active";
  if (status === "declined") return "Declined";
  return status;
}

function cleanLine(raw: string, min: number, max: number, label: string) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < min) return { ok: false as const, error: `Enter a ${label}.` };
  if (value.length > max) return { ok: false as const, error: `${label} must be ${max} characters or fewer.` };
  return { ok: true as const, value };
}

export function parseBusinessLead(
  fields: LeadFields,
  agentCookie: string | null | undefined,
  knownAgents?: readonly string[],
): { ok: true; draft: LeadDraft } | { ok: false; error: string; field: string } {
  const business = cleanLine(fields.businessName, 2, 80, "business name");
  if (!business.ok) return { ok: false, error: business.error, field: "businessName" };
  const contact = cleanLine(fields.contactName, 2, 80, "contact name");
  if (!contact.ok) return { ok: false, error: contact.error, field: "contactName" };
  const phone = parsePhone(fields.phone, "KE");
  if (!phone.ok) return { ok: false, error: phone.error, field: "phone" };
  const town = cleanLine(fields.town, 2, 60, "town");
  if (!town.ok) return { ok: false, error: town.error, field: "town" };
  const tierId = fields.tier.trim().toLowerCase();
  if (!isBusinessTier(tierId)) return { ok: false, error: "Choose a plan.", field: "tier" };
  const notes = fields.notes.trim().replace(/\s+/g, " ");
  if (notes.length > NOTES_MAX) {
    return { ok: false, error: `Notes must be ${NOTES_MAX} characters or fewer.`, field: "notes" };
  }
  return {
    ok: true,
    draft: {
      businessName: business.value,
      contactName: contact.value,
      phone: phone.e164,
      town: town.value,
      tier: tierId,
      notes,
      refCode: cleanRefCode(fields.refCode),
      agentCode: cleanAgentCode(fields.agentCode, agentCookie, knownAgents),
    },
  };
}

export async function takeBusinessLead(input: {
  fields: LeadFields;
  ip: string;
  agentCookie: string | null;
  knownAgents?: readonly string[];
  limit: (ip: string) => Promise<boolean>;
  create: (draft: LeadDraft) => Promise<void>;
}): Promise<{ ok: true; saved: boolean } | { ok: false; error: string; field?: string }> {
  const limited = await input.limit(input.ip || "unknown");
  if (honeypotTripped(input.fields.companyUrl)) return { ok: true, saved: false };
  if (limited) return { ok: false, error: BUSINESS_LEAD_LIMIT_MESSAGE };
  const parsed = parseBusinessLead(input.fields, input.agentCookie, input.knownAgents);
  if (!parsed.ok) return parsed;
  await input.create(parsed.draft);
  return { ok: true, saved: true };
}

export function cleanAdminNotes(raw: string): string | null {
  const notes = raw.trim().replace(/\s+/g, " ");
  if (notes.length > NOTES_MAX) return null;
  return notes;
}

export function leadChangeReason(
  before: { status: string; adminNotes: string },
  after: { status: string; adminNotes: string },
) {
  const parts: string[] = [];
  if (before.status !== after.status) {
    parts.push(`Status ${leadStatusLabel(before.status)} → ${leadStatusLabel(after.status)}.`);
  }
  if (before.adminNotes !== after.adminNotes) {
    parts.push(after.adminNotes ? `Notes: ${after.adminNotes}` : "Notes cleared.");
  }
  return parts.join(" ").slice(0, NOTES_MAX);
}

export type LeadSnapshot = { id: string; status: string; adminNotes: string };

export async function saveLeadUpdate(input: {
  id: string;
  status: string;
  adminNotes: string;
  find: (id: string) => Promise<LeadSnapshot | null>;
  update: (id: string, data: { status: string; adminNotes: string }) => Promise<void>;
  audit: (entry: { action: string; targetType: string; targetId: string; reason: string }) => Promise<void>;
}): Promise<{ ok: true; changed: boolean } | { ok: false; code: "status" | "notes" | "missing" }> {
  const status = input.status.trim().toLowerCase();
  if (!isLeadStatus(status)) return { ok: false, code: "status" };
  const adminNotes = cleanAdminNotes(input.adminNotes);
  if (adminNotes === null) return { ok: false, code: "notes" };
  const current = await input.find(input.id);
  if (!current) return { ok: false, code: "missing" };
  if (current.status === status && current.adminNotes === adminNotes) return { ok: true, changed: false };
  const reason = leadChangeReason(current, { status, adminNotes });
  await input.update(input.id, { status, adminNotes });
  await input.audit({
    action: "business_lead.update",
    targetType: "business_lead",
    targetId: input.id,
    reason,
  });
  return { ok: true, changed: true };
}

export const LEAD_CSV_COLUMNS = [
  "id",
  "createdAt",
  "businessName",
  "contactName",
  "phone",
  "town",
  "tier",
  "status",
  "notes",
  "adminNotes",
  "refCode",
  "agentCode",
] as const;

export type LeadCsvRow = {
  id: string;
  createdAt: Date;
  businessName: string;
  contactName: string;
  phone: string;
  town: string;
  tier: string;
  status: string;
  notes: string;
  adminNotes: string;
  refCode: string;
  agentCode: string | null;
};

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function businessLeadsCsv(rows: LeadCsvRow[]) {
  const lines = [LEAD_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    const cells = [
      row.id,
      row.createdAt.toISOString(),
      row.businessName,
      row.contactName,
      row.phone,
      row.town,
      row.tier,
      row.status,
      row.notes,
      row.adminNotes,
      row.refCode,
      row.agentCode ?? "",
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function leadStatusCounts(rows: { status: string }[]) {
  const counts: Record<LeadStatus, number> = { new: 0, contacted: 0, active: 0, declined: 0 };
  for (const row of rows) {
    if (isLeadStatus(row.status)) counts[row.status] += 1;
  }
  return counts;
}
