import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { applyStoredPhones, PHONE_NORMALISE_ACTION } from "@/lib/phone-cleanup";
import { phoneAuditReason, phoneFieldDiffs, planPhoneRow, type PhoneRow, type PhoneRowPlan } from "@/lib/phone";

/**
 * The live rows from the 11 Oct 2026 audit, including Samurai Kicks.
 * 2547266444175 is 13 digits and must stay flagged. It is never written.
 */
const auditRows: PhoneRow[] = [
  { kind: "listing", id: "cmuo8t1770002jp04rx5mt33c", city: "Nairobi", phone: "", whatsapp: "0722506974", label: "Usenge fish" },
  {
    kind: "listing",
    id: "cmv3w2lcb0001l806yoc1j4qq",
    city: "Nairobi",
    phone: "",
    whatsapp: "2547266444175",
    label: "Samurai Kicks",
  },
  {
    kind: "listing",
    id: "cmuljy7x70004ia0475yfcv58",
    city: "Nairobi",
    phone: "+254721642805+254738209115",
    whatsapp: "",
    label: "Two numbers",
  },
  { kind: "listing", id: "cmuzohjmr0002l804o96n4c1h", city: "Nairobi", phone: "0703727499", whatsapp: "", label: "Tilapia" },
  { kind: "user", id: "user_ok", city: "Nairobi", phone: "+254700000000", whatsapp: "", label: "Already fine" },
];

const actor = { id: "admin_1", email: "admin@rangach.co.ke", name: "Rangach Admin" };

type Stored = { id: string; city: string; phone: string; whatsapp: string; label: string };

type MemoryDb = {
  user: {
    findMany: () => Promise<Array<Stored & { name: string }>>;
    update: (args: { where: { id: string }; data: { phone: string; whatsapp: string } }) => Promise<void>;
  };
  listing: {
    findMany: () => Promise<
      Array<{ id: string; city: string; contactPhone: string; contactWhatsapp: string; title: string }>
    >;
    update: (args: { where: { id: string }; data: { contactPhone: string; contactWhatsapp: string } }) => Promise<void>;
  };
  adminAuditLog: {
    create: (args: {
      data: { action: string; reason: string; actorId: string; targetType: string; targetId: string };
    }) => Promise<void>;
  };
  $transaction: <T>(fn: (tx: MemoryDb) => Promise<T>) => Promise<T>;
};

function memory(rows: PhoneRow[]) {
  const users = new Map<string, Stored>();
  const listings = new Map<string, Stored>();
  for (const row of rows) {
    const stored = { id: row.id, city: row.city, phone: row.phone, whatsapp: row.whatsapp, label: row.label ?? "" };
    if (row.kind === "user") users.set(row.id, stored);
    else listings.set(row.id, stored);
  }
  const audits: Array<{ action: string; reason: string; actorId: string; targetType: string; targetId: string }> = [];
  const updates: string[] = [];
  const db: MemoryDb = {
    user: {
      findMany: async () => [...users.values()].map((row) => ({ ...row, name: row.label })),
      update: async ({ where, data }) => {
        updates.push(`user:${where.id}`);
        const row = users.get(where.id);
        if (!row) throw new Error(`missing user ${where.id}`);
        row.phone = data.phone;
        row.whatsapp = data.whatsapp;
      },
    },
    listing: {
      findMany: async () =>
        [...listings.values()].map((row) => ({
          id: row.id,
          city: row.city,
          contactPhone: row.phone,
          contactWhatsapp: row.whatsapp,
          title: row.label,
        })),
      update: async ({ where, data }) => {
        updates.push(`listing:${where.id}`);
        const row = listings.get(where.id);
        if (!row) throw new Error(`missing listing ${where.id}`);
        row.phone = data.contactPhone;
        row.whatsapp = data.contactWhatsapp;
      },
    },
    adminAuditLog: {
      create: async ({ data }) => {
        audits.push(data);
      },
    },
    $transaction: async (fn) => fn(db),
  };
  return { db: db as unknown as PrismaClient, audits, updates, listings };
}

test("the dry run lists each fixable field and flags the 13-digit number", () => {
  const diffs = auditRows.map(planPhoneRow).flatMap(phoneFieldDiffs);
  const fixes = diffs.filter((diff) => diff.fixable);
  const manual = diffs.filter((diff) => diff.manualReason);
  assert.deepEqual(
    fixes.map((diff) => [diff.field, diff.current, diff.proposed]),
    [
      ["contactWhatsapp", "0722506974", "+254722506974"],
      ["contactPhone", "+254721642805+254738209115", "+254721642805"],
      ["contactWhatsapp", "", "+254738209115"],
      ["contactPhone", "0703727499", "+254703727499"],
    ],
  );
  assert.equal(new Set(fixes.map((diff) => diff.id)).size, 3);
  assert.equal(manual.length, 1);
  assert.equal(manual[0]?.label, "Samurai Kicks");
  assert.equal(manual[0]?.field, "contactWhatsapp");
  assert.equal(manual[0]?.current, "2547266444175");
  assert.equal(manual[0]?.proposed, "2547266444175");
  assert.equal(manual[0]?.fixable, false);
  assert.match(manual[0]?.manualReason ?? "", /too many digits/);
  assert.equal(diffs.some((diff) => diff.id === "user_ok"), false);
});

test("apply writes the three fixable records once, keeps the 13-digit number, and audits before and after", async () => {
  const { db, audits, updates, listings } = memory(auditRows);
  const plans = auditRows.map(planPhoneRow);
  const reason = phoneAuditReason(plans);
  assert.match(reason, /Updated 3 rows\./);
  assert.match(reason, /Usenge fish cmuo8t1770002jp04rx5mt33c \(Nairobi\) contactWhatsapp: 0722506974 → \+254722506974/);
  assert.match(reason, /contactPhone: \+254721642805\+254738209115 → \+254721642805/);
  assert.match(reason, /contactWhatsapp: \(empty\) → \+254738209115/);
  assert.match(reason, /Tilapia cmuzohjmr0002l804o96n4c1h \(Nairobi\) contactPhone: 0703727499 → \+254703727499/);
  assert.match(reason, /Left for a manual fix:/);
  assert.match(reason, /Samurai Kicks cmv3w2lcb0001l806yoc1j4qq \(Nairobi\) contactWhatsapp: 2547266444175 — That number has too many digits/);
  assert.equal(reason.includes("2547266444175 →"), false);

  const first = await applyStoredPhones(db, actor);
  assert.equal(first.written, 3);
  assert.equal(first.reason, reason);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, PHONE_NORMALISE_ACTION);
  assert.equal(audits[0]?.actorId, actor.id);
  assert.equal(audits[0]?.targetType, "phones");
  assert.equal(audits[0]?.reason, reason);
  assert.equal(audits[0]?.reason.includes("2547266444175 →"), false);
  assert.deepEqual(updates, [
    "listing:cmuo8t1770002jp04rx5mt33c",
    "listing:cmuljy7x70004ia0475yfcv58",
    "listing:cmuzohjmr0002l804o96n4c1h",
  ]);
  assert.equal(listings.get("cmv3w2lcb0001l806yoc1j4qq")?.whatsapp, "2547266444175");
  assert.equal(listings.get("cmuo8t1770002jp04rx5mt33c")?.whatsapp, "+254722506974");
  assert.equal(listings.get("cmuljy7x70004ia0475yfcv58")?.phone, "+254721642805");
  assert.equal(listings.get("cmuljy7x70004ia0475yfcv58")?.whatsapp, "+254738209115");
  assert.equal(listings.get("cmuzohjmr0002l804o96n4c1h")?.phone, "+254703727499");

  const second = await applyStoredPhones(db, actor);
  assert.equal(second.written, 0);
  assert.equal(second.reason, "");
  assert.equal(audits.length, 1);
  assert.equal(updates.length, 3);
  assert.equal(listings.get("cmv3w2lcb0001l806yoc1j4qq")?.whatsapp, "2547266444175");
  const again = (second.plans as PhoneRowPlan[]).find((plan) => plan.id === "cmv3w2lcb0001l806yoc1j4qq");
  assert.equal(again?.changed, false);
  assert.match(again?.reports[0]?.message ?? "", /too many digits/);
});

test("the phone admin page and apply action require an admin before they read or write", () => {
  const page = readFileSync(new URL("../app/admin/phones/page.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/admin/phones/actions.ts", import.meta.url), "utf8");
  const script = readFileSync(new URL("../../scripts/normalize-phones.mjs", import.meta.url), "utf8");
  const pageBody = page.slice(page.indexOf("export default"));
  const actionBody = action.slice(action.indexOf("export async function applyPhoneNumbers"));
  assert.match(pageBody, /await requireAdmin\("\/admin\/phones"\)/);
  assert.equal(pageBody.indexOf("requireAdmin") < pageBody.indexOf("readPhoneRows"), true);
  assert.match(actionBody, /await requireAdmin\("\/admin\/phones"\)/);
  assert.equal(actionBody.indexOf("requireAdmin") < actionBody.indexOf("applyStoredPhones"), true);
  assert.match(script, /readPhoneRows/);
  assert.match(script, /planPhoneRow/);
  assert.match(script, /writePhonePlan/);
  assert.equal(script.includes("function parsePhone"), false);
});
