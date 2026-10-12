import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminContactDetails } from "@/components/admin-contact-details";
import {
  LISTING_CONTACT_ACTION,
  USER_CONTACT_ACTION,
  contactAuditReason,
  planAdminContactEdit,
  sellerMailto,
  sellerWhatsappHref,
  updateListingContact,
  updateUserContact,
} from "@/lib/admin-contact";
import { REASON_TOO_SHORT } from "@/lib/moderation";

const actor = { id: "admin_1", email: "admin@rangach.co.ke", name: "Rangach Admin" };
const SAMURAI = "cmv3w2lcb0001l806yoc1j4qq";

type Stored = { id: string; city: string; phone: string; whatsapp: string };

type AuditRow = { action: string; reason: string; actorId: string; targetType: string; targetId: string };

type MemoryDb = {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<(Stored & { phone: string; whatsapp: string }) | null>;
    update: (args: { where: { id: string }; data: { phone: string; whatsapp: string } }) => Promise<void>;
  };
  listing: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ id: string; city: string; contactPhone: string; contactWhatsapp: string } | null>;
    update: (args: { where: { id: string }; data: { contactPhone: string; contactWhatsapp: string } }) => Promise<void>;
  };
  adminAuditLog: { create: (args: { data: AuditRow }) => Promise<void> };
  $transaction: <T>(fn: (tx: MemoryDb) => Promise<T>) => Promise<T>;
};

function memory(users: Stored[], listings: Stored[]) {
  const userRows = new Map(users.map((row) => [row.id, { ...row }]));
  const listingRows = new Map(listings.map((row) => [row.id, { ...row }]));
  const audits: AuditRow[] = [];
  const db: MemoryDb = {
    user: {
      findUnique: async ({ where }) => userRows.get(where.id) ?? null,
      update: async ({ where, data }) => {
        const row = userRows.get(where.id);
        if (!row) throw new Error(`missing user ${where.id}`);
        row.phone = data.phone;
        row.whatsapp = data.whatsapp;
      },
    },
    listing: {
      findUnique: async ({ where }) => {
        const row = listingRows.get(where.id);
        if (!row) return null;
        return { id: row.id, city: row.city, contactPhone: row.phone, contactWhatsapp: row.whatsapp };
      },
      update: async ({ where, data }) => {
        const row = listingRows.get(where.id);
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
  return { db: db as unknown as PrismaClient, audits, userRows, listingRows };
}

test("a bad listing number is rejected, a valid one is E.164, and a blank clears", () => {
  const bad = planAdminContactEdit({
    phone: "",
    whatsapp: "2547266444175",
    city: "Nairobi",
    reason: "Fix Samurai Kicks",
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.field, "whatsapp");
  assert.match(bad.error, /too many digits/);

  const short = planAdminContactEdit({ phone: "0712345678", whatsapp: "", city: "Nairobi", reason: "no" });
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.error, REASON_TOO_SHORT);

  const saved = planAdminContactEdit({
    phone: "",
    whatsapp: "0726 644 417",
    city: "Nairobi",
    reason: "  Replace the extra digit  ",
  });
  assert.deepEqual(saved, {
    ok: true,
    phone: "",
    whatsapp: "+254726644417",
    reason: "Replace the extra digit",
  });

  const cleared = planAdminContactEdit({ phone: "  ", whatsapp: "", city: "Nairobi", reason: "Clear both" });
  assert.deepEqual(cleared, { ok: true, phone: "", whatsapp: "", reason: "Clear both" });
});

test("the audit line keeps before and after, including a cleared number", () => {
  const reason = contactAuditReason(
    "listing",
    { phone: "", whatsapp: "2547266444175" },
    { phone: "", whatsapp: "+254726644417" },
    "Replace the extra digit",
  );
  assert.match(reason, /contactPhone: \(empty\) → \(empty\)/);
  assert.match(reason, /contactWhatsapp: 2547266444175 → \+254726644417/);
  assert.match(reason, /Replace the extra digit/);

  const long = contactAuditReason(
    "user",
    { phone: "0712345678", whatsapp: "" },
    { phone: "+254712345678", whatsapp: "" },
    "x".repeat(500),
  );
  assert.ok(long.length <= 500);
  assert.match(long, /phone: 0712345678 → \+254712345678/);
  assert.match(long, /whatsapp: \(empty\) → \(empty\)/);
});

test("saving a listing number writes one audit and leaves a bad number untouched", async () => {
  const { db, audits, listingRows } = memory(
    [],
    [{ id: SAMURAI, city: "Nairobi", phone: "", whatsapp: "2547266444175" }],
  );
  const rejected = await updateListingContact(db, actor, SAMURAI, {
    phone: "",
    whatsapp: "2547266444175",
    reason: "Try the same bad number",
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.error, /too many digits/);
  assert.equal(listingRows.get(SAMURAI)?.whatsapp, "2547266444175");
  assert.equal(audits.length, 0);

  const saved = await updateListingContact(db, actor, SAMURAI, {
    phone: "",
    whatsapp: "0726644417",
    reason: "Replace the extra digit",
  });
  assert.deepEqual(saved, { ok: true, phone: "", whatsapp: "+254726644417" });
  assert.equal(listingRows.get(SAMURAI)?.whatsapp, "+254726644417");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, LISTING_CONTACT_ACTION);
  assert.equal(audits[0]?.actorId, actor.id);
  assert.equal(audits[0]?.targetType, "listing");
  assert.equal(audits[0]?.targetId, SAMURAI);
  assert.match(audits[0]?.reason ?? "", /contactWhatsapp: 2547266444175 → \+254726644417/);
  assert.match(audits[0]?.reason ?? "", /Replace the extra digit/);

  const cleared = await updateListingContact(db, actor, SAMURAI, {
    phone: "",
    whatsapp: "",
    reason: "Clear the listing number",
  });
  assert.deepEqual(cleared, { ok: true, phone: "", whatsapp: "" });
  assert.equal(listingRows.get(SAMURAI)?.whatsapp, "");
  assert.equal(audits.length, 2);
  assert.match(audits[1]?.reason ?? "", /contactWhatsapp: \+254726644417 → \(empty\)/);
});

test("a missing listing and a short reason do not write an audit", async () => {
  const missingDb = memory([], []);
  const missing = await updateListingContact(missingDb.db, actor, "gone", {
    phone: "0712345678",
    whatsapp: "",
    reason: "Fix a missing listing",
  });
  assert.equal(missing.ok, false);
  assert.equal(missingDb.audits.length, 0);

  const userDb = memory([{ id: "user_1", city: "Nairobi", phone: "0712345678", whatsapp: "" }], []);
  const short = await updateUserContact(userDb.db, actor, "user_1", {
    phone: "0712345678",
    whatsapp: "",
    reason: "no",
  });
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.field, "reason");
  assert.equal(userDb.audits.length, 0);
  assert.equal(userDb.userRows.get("user_1")?.phone, "0712345678");
});

test("saving a shop owner's numbers writes the account and one audit", async () => {
  const { db, audits, userRows } = memory(
    [{ id: "shop_owner", city: "Nairobi", phone: "0712345678", whatsapp: "" }],
    [],
  );
  const saved = await updateUserContact(db, actor, "shop_owner", {
    phone: "0712345678",
    whatsapp: "+254722506974",
    reason: "Add the shop WhatsApp",
  });
  assert.deepEqual(saved, { ok: true, phone: "+254712345678", whatsapp: "+254722506974" });
  assert.equal(userRows.get("shop_owner")?.phone, "+254712345678");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, USER_CONTACT_ACTION);
  assert.equal(audits[0]?.targetType, "user");
  assert.match(audits[0]?.reason ?? "", /phone: 0712345678 → \+254712345678/);
  assert.match(audits[0]?.reason ?? "", /whatsapp: \(empty\) → \+254722506974/);
});

test("contact seller links use mailto, and wa.me only for E.164", () => {
  assert.equal(sellerMailto("  seller@example.com "), "mailto:seller@example.com");
  assert.equal(sellerMailto(""), "");
  assert.equal(sellerMailto("not-an-email"), "");
  assert.equal(sellerWhatsappHref("2547266444175", "0712345678"), "");
  assert.equal(sellerWhatsappHref("2547266444175", "+254712345678"), "https://wa.me/254712345678");
  assert.equal(sellerWhatsappHref("+254722506974", "+254712345678"), "https://wa.me/254722506974");

  const flagged = renderToStaticMarkup(
    createElement(AdminContactDetails, {
      owner: { email: "seller@example.com", phone: "", whatsapp: "" },
      listing: { contactName: "Sam", contactPhone: "", contactWhatsapp: "2547266444175" },
      editHref: `/admin/contact/listing/${SAMURAI}`,
    }),
  );
  assert.match(flagged, /Contact details/);
  assert.match(flagged, /seller@example.com/);
  assert.match(flagged, /mailto:seller@example.com/);
  assert.match(flagged, /2547266444175/);
  assert.equal(flagged.includes("wa.me"), false);
  assert.match(flagged, new RegExp(`/admin/contact/listing/${SAMURAI}`));

  const valid = renderToStaticMarkup(
    createElement(AdminContactDetails, {
      owner: { email: "seller@example.com", phone: "+254700000000", whatsapp: "" },
      listing: { contactName: "", contactPhone: "", contactWhatsapp: "+254712345678" },
    }),
  );
  assert.match(valid, /https:\/\/wa\.me\/254712345678/);
  assert.equal(valid.includes("wa.me/254700000000"), false);
  assert.equal(valid.includes("Edit"), false);
});

test("the edit action and pages require an admin, and public pages do not render owner contact", () => {
  const action = readFileSync(new URL("./actions/admin-contact.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/admin/contact/[kind]/[id]/page.tsx", import.meta.url), "utf8");
  const phones = readFileSync(new URL("../app/admin/phones/page.tsx", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const lib = readFileSync(new URL("./admin-contact.ts", import.meta.url), "utf8");
  const actionBody = action.slice(action.indexOf("export async function saveAdminContact"));
  assert.match(actionBody, /await requireAdmin\("\/admin"\)/);
  assert.equal(actionBody.indexOf("requireAdmin") < actionBody.indexOf("updateListingContact"), true);
  assert.equal(actionBody.indexOf("requireAdmin") < actionBody.indexOf("updateUserContact"), true);
  const pageBody = page.slice(page.indexOf("export default"));
  assert.match(pageBody, /await requireAdmin\(`\/admin\/contact\/\$\{kind\}\/\$\{id\}`\)/);
  assert.equal(pageBody.indexOf("requireAdmin") < pageBody.indexOf("findUnique"), true);
  assert.match(phones, /AdminContactDetails/);
  assert.match(phones, />\s*Edit\s*</);
  assert.match(phones, /listingContactHref/);
  assert.match(admin, /AdminContactDetails/);
  assert.match(lib, /normalizeContactPair/);
  assert.equal(lib.includes("function parsePhone"), false);

  const publicFiles = [
    "../app/b/[slug]/page.tsx",
    "../app/listings/[id]/page.tsx",
    "../app/people/[id]/page.tsx",
    "./search.ts",
    "./share-metadata.ts",
    "./og-model.ts",
  ];
  for (const file of publicFiles) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.equal(source.includes("AdminContactDetails"), false, file);
    assert.equal(source.includes("admin-contact"), false, file);
  }
});
