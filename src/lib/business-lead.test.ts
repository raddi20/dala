import assert from "node:assert/strict";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessTierSection } from "@/components/business-tiers";
import { backBarTitle, backFallback } from "@/lib/back-nav";
import {
  BUSINESS_LEAD_LIMIT_MESSAGE,
  businessInterestHref,
  businessLeadsCsv,
  cleanAgentCode,
  cleanRefCode,
  leadStatusCounts,
  parseBusinessLead,
  saveLeadUpdate,
  takeBusinessLead,
  type LeadDraft,
  type LeadFields,
} from "@/lib/business-lead";
import {
  BUSINESS_TIERS,
  KISUMU_QR_REF,
  businessSignupUrl,
  tierPriceView,
} from "@/lib/business-tiers";
import { PAID_UPGRADES_COMING_SOON } from "@/lib/payments/live";
import { BUSINESS_LEAD_LIMIT, limitBusinessLead, type MemoryBucket } from "@/lib/rate-limit";
import { staticPublicPaths } from "@/lib/sitemap-entries";

const rates = { USD: 1, KES: 129, GBP: 0.75 };
const money = { rates, kesPerUsd: 129, kesPerGbp: 170 };

function fields(overrides: Partial<LeadFields> = {}): LeadFields {
  return {
    businessName: "Lake Tilapia",
    contactName: "Akinyi",
    phone: "0712 345 678",
    town: "Kisumu",
    tier: "starter",
    notes: "Saturday tilapia, or catering for an ayie.",
    refCode: "kisumu-qr",
    agentCode: "",
    companyUrl: "",
    ...overrides,
  };
}

test("the three plans keep the launch prices", () => {
  const [starter, pro, business] = BUSINESS_TIERS;
  assert.equal(starter?.kes, 1500);
  assert.equal(starter?.offer, "First month free");
  assert.equal(pro?.kes, 4500);
  assert.equal(pro?.offer, "");
  assert.equal(business?.kes, 10000);
  assert.equal(business?.kesTo, 15000);
  assert.equal(business?.contactUs, true);
});

test("prices follow the visitor currency and the invoice stays in shillings", () => {
  const starter = BUSINESS_TIERS[0];
  const business = BUSINESS_TIERS[2];
  assert.ok(starter && business);
  assert.equal(tierPriceView(starter, { ...money, country: "KE" }).primary, "KES 1,500");
  assert.equal(tierPriceView(starter, { ...money, country: "US" }).primary, "≈ $12");
  assert.equal(tierPriceView(starter, { ...money, country: "GB" }).primary, "£9");
  assert.equal(tierPriceView(business, { ...money, country: "KE" }).primary, "KES 10,000–15,000");
  assert.equal(tierPriceView(business, { ...money, country: "US" }).primary, "≈ $78–$116");
  assert.match(tierPriceView(starter, { ...money, country: "US" }).caption, /Kenyan shillings/);
  assert.equal(tierPriceView(starter, { ...money, country: null }).primary, "KES 1,500");
  assert.equal(tierPriceView(starter, { ...money, country: null }).secondary, "£9");
});

test("the tier cards name the plans, hide checkout, and respect the payments flag", () => {
  const off = renderToStaticMarkup(
    createElement(BusinessTierSection, { country: "KE", ...money, live: false }),
  );
  assert.match(off, /Kenya, East Africa and the Diaspora/);
  assert.match(off, /Duka Starter/);
  assert.match(off, /Duka Pro/);
  assert.match(off, /KES 1,500/);
  assert.match(off, /First month free/);
  assert.match(off, /KES 4,500/);
  assert.match(off, /KES 10,000–15,000/);
  assert.match(off, /Contact us/);
  assert.match(off, new RegExp(PAID_UPGRADES_COMING_SOON));
  assert.match(off, /no card payment/i);
  assert.equal(off.includes("/upgrade"), false);
  assert.equal(/checkout/i.test(off), false);
  assert.equal(/escrow/i.test(off), false);
  assert.equal(/funeral/i.test(off), false);
  assert.match(off, /fundi in Kisumu/);

  const on = renderToStaticMarkup(
    createElement(BusinessTierSection, { country: "KE", ...money, live: true, refCode: "kisumu-qr" }),
  );
  assert.equal(on.includes(PAID_UPGRADES_COMING_SOON), false);
  assert.match(on, /href="\/business\?tier=starter&amp;ref=kisumu-qr#signup"/);
});

test("a valid sign-up stores E.164, the ref, and a known agent, and drops the IP", async () => {
  const saved: LeadDraft[] = [];
  const result = await takeBusinessLead({
    fields: fields({ agentCode: "a1", phone: "0712 345 678" }),
    ip: "203.0.113.44",
    agentCookie: null,
    limit: async () => false,
    create: async (draft) => {
      saved.push(draft);
    },
  });
  assert.deepEqual(result, { ok: true, saved: true });
  assert.equal(saved[0]?.phone, "+254712345678");
  assert.equal(saved[0]?.refCode, "kisumu-qr");
  assert.equal(saved[0]?.agentCode, "A1");
  assert.equal(JSON.stringify(saved[0]).includes("203.0.113.44"), false);
  assert.equal(cleanAgentCode("nope", "A2"), "A2");
  assert.equal(cleanAgentCode("zz", null), null);
  assert.equal(cleanRefCode("Kisumu-QR"), "kisumu-qr");
  assert.equal(cleanRefCode("javascript:alert(1)"), "");
  assert.equal(businessInterestHref("pro", "kisumu-qr"), "/business?tier=pro&ref=kisumu-qr#signup");
});

test("a honeypot and a rate limit do not save a lead", async () => {
  let creates = 0;
  const create = async () => {
    creates += 1;
  };
  const bot = await takeBusinessLead({
    fields: fields({ companyUrl: "https://spam.example" }),
    ip: "203.0.113.44",
    agentCookie: null,
    limit: async () => false,
    create,
  });
  assert.deepEqual(bot, { ok: true, saved: false });
  const limited = await takeBusinessLead({
    fields: fields(),
    ip: "203.0.113.44",
    agentCookie: null,
    limit: async () => true,
    create,
  });
  assert.deepEqual(limited, { ok: false, error: BUSINESS_LEAD_LIMIT_MESSAGE });
  assert.equal(creates, 0);
  const bad = parseBusinessLead(fields({ phone: "123" }), null);
  assert.equal(bad.ok, false);
});

test("the business-lead limiter hashes the IP and blocks after five in an hour", async () => {
  const memory = new Map<string, MemoryBucket>();
  const now = 1_700_000_000_000;
  const ip = "203.0.113.44";
  for (let i = 0; i < BUSINESS_LEAD_LIMIT; i += 1) {
    assert.equal(await limitBusinessLead(ip, { memory, durable: null, now }), false);
  }
  assert.equal(await limitBusinessLead(ip, { memory, durable: null, now }), true);
  const key = [...memory.keys()][0] ?? "";
  assert.equal(key.startsWith("business_lead:"), true);
  assert.equal(key.includes(ip), false);
});

test("admin changes write one audit row, and CSV escapes phones and commas", async () => {
  const audits: { action: string; reason: string }[] = [];
  let row = { id: "lead_1", status: "new", adminNotes: "" };
  const saved = await saveLeadUpdate({
    id: "lead_1",
    status: "contacted",
    adminNotes: "Called about tilapia",
    find: async () => row,
    update: async (_id, data) => {
      row = { ...row, ...data };
    },
    audit: async (entry) => {
      audits.push(entry);
    },
  });
  assert.equal(saved.ok, true);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "business_lead.update");
  assert.match(audits[0]?.reason ?? "", /New → Contacted/);
  const again = await saveLeadUpdate({
    id: "lead_1",
    status: "contacted",
    adminNotes: "Called about tilapia",
    find: async () => row,
    update: async () => {
      throw new Error("no change");
    },
    audit: async () => {
      throw new Error("no audit");
    },
  });
  assert.deepEqual(again, { ok: true, changed: false });
  const bad = await saveLeadUpdate({
    id: "missing",
    status: "paid",
    adminNotes: "",
    find: async () => null,
    update: async () => {},
    audit: async () => {},
  });
  assert.deepEqual(bad, { ok: false, code: "status" });

  const csv = businessLeadsCsv([
    {
      id: "lead_1",
      createdAt: new Date("2026-10-14T09:00:00.000Z"),
      businessName: "Lake Tilapia, Kisumu",
      contactName: "Akinyi",
      phone: "+254712345678",
      town: "Kisumu",
      tier: "starter",
      status: "new",
      notes: 'Said "ayie"',
      adminNotes: "",
      refCode: "kisumu-qr",
      agentCode: "A1",
    },
  ]);
  assert.match(csv, /^id,createdAt,businessName,/);
  assert.match(csv, /"Lake Tilapia, Kisumu"/);
  assert.match(csv, /'\+254712345678/);
  assert.match(csv, /"Said ""ayie"""/);
  assert.equal(leadStatusCounts([{ status: "new" }, { status: "new" }, { status: "active" }]).new, 2);
});

test("the Kisumu QR opens the sign-up with ref=kisumu-qr and the pages stay public", () => {
  assert.equal(KISUMU_QR_REF, "kisumu-qr");
  assert.equal(
    businessSignupUrl("https://www.rangach.co.ke/", KISUMU_QR_REF),
    "https://www.rangach.co.ke/business?ref=kisumu-qr",
  );
  assert.equal(backFallback({ pathname: "/business/kisumu" }), "/business");
  assert.equal(backBarTitle({ pathname: "/business" }), "Rangach Business");
  assert.equal(backBarTitle({ pathname: "/admin/business" }), "Business sign-ups");
  assert.ok(staticPublicPaths().some((item) => item.path === "/business"));
  assert.equal(staticPublicPaths().some((item) => item.path === "/admin/business"), false);

  const sheet = readFileSync(new URL("../app/business/kisumu/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/business-lead-form.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("./actions/business.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  for (const source of [sheet, form, action]) {
    assert.equal(/funeral/i.test(source), false);
    assert.equal(/escrow/i.test(source), false);
    assert.equal(/paystack/i.test(source), false);
  }
  assert.match(sheet, /StickerQr/);
  assert.match(sheet, /KISUMU_QR_REF/);
  assert.match(form, /HONEYPOT_FIELD/);
  assert.match(form, /href="\/privacy"/);
  assert.match(form, /BUSINESS_LEAD_THANKS/);
  assert.match(action, /limitBusinessLead/);
  assert.match(action, /prisma\.businessLead\.create/);
  assert.match(schema, /model BusinessLead/);
  assert.match(schema, /agentCode\s+String\?/);
  assert.equal(schema.includes("ipAddress"), false);
});
