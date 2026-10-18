import type { PrismaClient } from "@prisma/client";
import { canonicalCity, regionForCity } from "@/lib/constants";
import type { AdminActor } from "@/lib/moderation";
import { REASON_TOO_SHORT, requiredReason } from "@/lib/moderation";
import { normalizeContactPair, waMeDigits, type PhoneField } from "@/lib/phone";

export const LISTING_CONTACT_ACTION = "listing.contact";
export const USER_CONTACT_ACTION = "user.contact";

const MISSING = "That record is no longer there.";
const REASON_MAX = 500;

export type ContactKind = "listing" | "user";

export type ContactEditInput = {
  phone: string;
  whatsapp: string;
  reason: string;
  /** Empty or omitted leaves the stored town alone. */
  city?: string;
};

export type ContactFormState = {
  error: string;
  field: PhoneField | "reason" | "city";
};

export type ContactEditResult = { ok: true; phone: string; whatsapp: string } | ({ ok: false } & ContactFormState);

export type PlannedContact = { ok: true; phone: string; whatsapp: string; reason: string } | ({ ok: false } & ContactFormState);

type StoredNumbers = { phone: string; whatsapp: string };

/** Listing contact page. */
export function listingContactHref(id: string) {
  return `/admin/contact/listing/${encodeURIComponent(id)}`;
}

/** Account phone page, including a shop owner. */
export function userContactHref(id: string) {
  return `/admin/contact/user/${encodeURIComponent(id)}`;
}

/** mailto for the owner's login email. Empty when the address is not usable. */
export function sellerMailto(email: string): string {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) return "";
  return `mailto:${trimmed}`;
}

/**
 * One wa.me link. The first value that is already E.164 wins.
 * A local number or a bad value such as 2547266444175 produces no link.
 */
export function sellerWhatsappHref(...numbers: Array<string | null | undefined>): string {
  for (const number of numbers) {
    const digits = waMeDigits(number ?? "");
    if (digits) return `https://wa.me/${digits}`;
  }
  return "";
}

export function planAdminContactEdit(input: ContactEditInput & { city: string }): PlannedContact {
  const reason = requiredReason(input.reason);
  if (!reason) return { ok: false, error: REASON_TOO_SHORT, field: "reason" };
  const phones = normalizeContactPair({
    phone: input.phone,
    whatsapp: input.whatsapp,
    city: input.city,
  });
  if (!phones.ok) return { ok: false, error: phones.error, field: phones.field };
  return { ok: true, phone: phones.phone, whatsapp: phones.whatsapp, reason };
}

function show(value: string) {
  return value.trim() ? value.trim() : "(empty)";
}

function postedTown(value: string | undefined): { ok: true; city: string } | { ok: false; error: string } {
  const raw = value?.trim() ?? "";
  if (!raw) return { ok: true, city: "" };
  const city = canonicalCity(raw);
  if (!city) return { ok: false, error: "Choose a town." };
  return { ok: true, city };
}

/** Before and after stay in the audit text. A long note is shortened so the line still fits. */
export function contactAuditReason(
  kind: ContactKind,
  before: StoredNumbers,
  after: StoredNumbers,
  reason: string,
  cityNote = "",
): string {
  const phoneLabel = kind === "listing" ? "contactPhone" : "phone";
  const whatsappLabel = kind === "listing" ? "contactWhatsapp" : "whatsapp";
  const change = `${phoneLabel}: ${show(before.phone)} → ${show(after.phone)}; ${whatsappLabel}: ${show(before.whatsapp)} → ${show(after.whatsapp)}${cityNote ? `; ${cityNote}` : ""}`;
  const note = reason.trim().replace(/\s+/g, " ");
  const joiner = ". ";
  if (change.length + joiner.length + note.length <= REASON_MAX) return `${change}${joiner}${note}`;
  const room = REASON_MAX - change.length - joiner.length;
  return `${change}${joiner}${note.slice(0, Math.max(0, room))}`.trimEnd();
}

function auditData(actor: AdminActor, action: string, targetType: string, targetId: string, reason: string) {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    action,
    targetType,
    targetId,
    reason,
  };
}

export async function updateListingContact(
  db: PrismaClient,
  actor: AdminActor,
  id: string,
  input: ContactEditInput,
): Promise<ContactEditResult> {
  const listing = await db.listing.findUnique({
    where: { id },
    select: { id: true, city: true, contactPhone: true, contactWhatsapp: true },
  });
  if (!listing) return { ok: false, error: MISSING, field: "phone" };
  const town = postedTown(input.city);
  if (!town.ok) return { ok: false, error: town.error, field: "city" };
  const plan = planAdminContactEdit({ ...input, city: town.city || listing.city });
  if (!plan.ok) return plan;
  const before = { phone: listing.contactPhone, whatsapp: listing.contactWhatsapp };
  const after = { phone: plan.phone, whatsapp: plan.whatsapp };
  const cityChanged = Boolean(town.city) && town.city !== listing.city;
  const cityNote = cityChanged ? `city: ${show(listing.city)} → ${town.city}` : "";
  await db.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id },
      data: {
        contactPhone: after.phone,
        contactWhatsapp: after.whatsapp,
        ...(cityChanged ? { city: town.city, region: regionForCity(town.city) } : {}),
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(
        actor,
        LISTING_CONTACT_ACTION,
        "listing",
        id,
        contactAuditReason("listing", before, after, plan.reason, cityNote),
      ),
    });
  });
  return { ok: true, phone: after.phone, whatsapp: after.whatsapp };
}

export async function updateUserContact(
  db: PrismaClient,
  actor: AdminActor,
  id: string,
  input: ContactEditInput,
): Promise<ContactEditResult> {
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, city: true, phone: true, whatsapp: true },
  });
  if (!user) return { ok: false, error: MISSING, field: "phone" };
  const town = postedTown(input.city);
  if (!town.ok) return { ok: false, error: town.error, field: "city" };
  const plan = planAdminContactEdit({ ...input, city: town.city || user.city });
  if (!plan.ok) return plan;
  const before = { phone: user.phone, whatsapp: user.whatsapp };
  const after = { phone: plan.phone, whatsapp: plan.whatsapp };
  const cityChanged = Boolean(town.city) && town.city !== user.city;
  const cityNote = cityChanged ? `city: ${show(user.city)} → ${town.city}` : "";
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        phone: after.phone,
        whatsapp: after.whatsapp,
        ...(cityChanged ? { city: town.city } : {}),
      },
    });
    await tx.adminAuditLog.create({
      data: auditData(actor, USER_CONTACT_ACTION, "user", id, contactAuditReason("user", before, after, plan.reason, cityNote)),
    });
  });
  return { ok: true, phone: after.phone, whatsapp: after.whatsapp };
}
