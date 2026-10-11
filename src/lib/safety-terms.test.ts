import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import FaqPage from "@/app/faq/page";
import SafetyPage from "@/app/safety/page";
import { RegisterForm } from "@/components/auth-forms";
import { PaymentSafetyNote } from "@/components/seller-contact";
import { createRegisteredUser, type RegisterUserDb } from "@/lib/register-user";
import { registerSchema } from "@/lib/validators";

test("WhatsApp and call areas link the M-Pesa warning to the safety tips", async () => {
  const note = renderToStaticMarkup(createElement(PaymentSafetyNote));
  assert.match(note, /Never send an M-Pesa deposit before you/);
  assert.match(note, /confirmed the seller/);
  assert.match(note, /href="\/safety"/);

  const safety = renderToStaticMarkup(SafetyPage());
  const faq = renderToStaticMarkup(await FaqPage());
  for (const html of [safety, faq]) {
    assert.match(html, /Never send an M-Pesa deposit before you/);
    assert.match(html, /confirmed the seller/);
    assert.match(html, /Phone verified badge/);
    assert.match(html, /till, paybill/);
    assert.match(html, /does not hold the money/);
  }
  assert.match(faq, /href="\/safety"/);
  assert.match(safety, /Confirm the seller first/);
  assert.match(safety, /Pay the number on the shop/);
});

test("sign-up requires agreement and stores the time, without touching an existing account", async () => {
  const html = renderToStaticMarkup(createElement(RegisterForm, { nextPath: "/account/storefront" }));
  assert.match(html, /I agree to the/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /Terms/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /Privacy Policy/);
  assert.match(html, /name="terms"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /required/);
  assert.match(html, /name="next" value="\/account\/storefront"/);
  assert.match(html, /href="\/login\?next=%2Faccount%2Fstorefront"/);

  const base = {
    name: "Akinyi",
    email: "akinyi@example.com",
    password: "password1",
    kind: "person" as const,
    city: "Nairobi",
  };
  const missing = registerSchema.safeParse({ ...base, terms: "" });
  assert.equal(missing.success, false);
  if (!missing.success) assert.match(missing.error.issues[0]?.message ?? "", /Terms and Privacy Policy/);
  const unchecked = registerSchema.safeParse(base);
  assert.equal(unchecked.success, false);
  const agreed = registerSchema.safeParse({ ...base, terms: "1" });
  assert.equal(agreed.success, true);

  const now = new Date("2026-10-11T09:00:00.000Z");
  type Row = {
    email: string;
    referralAgentCode: string | null;
    referralAgentAt: Date | null;
    termsAcceptedAt: Date | null;
  };
  const rows = new Map<string, Row>();
  const db: RegisterUserDb = {
    async findByEmail(email) {
      const row = rows.get(email);
      return row ? { referralAgentCode: row.referralAgentCode } : null;
    },
    async create(data) {
      rows.set(data.email, {
        email: data.email,
        referralAgentCode: data.referralAgentCode,
        referralAgentAt: data.referralAgentAt,
        termsAcceptedAt: data.termsAcceptedAt,
      });
      return { id: "user-1", referralAgentCode: data.referralAgentCode };
    },
  };
  const created = await createRegisteredUser(db, {
    name: "Akinyi",
    email: "akinyi@example.com",
    passwordHash: "hash",
    kind: "business",
    city: "Nairobi",
    agentCookie: "a1",
    now,
  });
  assert.equal(created.ok, true);
  assert.equal(rows.get("akinyi@example.com")?.referralAgentCode, "A1");
  assert.equal(rows.get("akinyi@example.com")?.termsAcceptedAt?.toISOString(), now.toISOString());

  const again = await createRegisteredUser(db, {
    name: "Akinyi",
    email: "akinyi@example.com",
    passwordHash: "other",
    kind: "business",
    city: "London",
    agentCookie: "A2",
    now: new Date("2026-10-12T00:00:00.000Z"),
  });
  assert.deepEqual(again, { ok: false, error: "That email is already registered." });
  assert.equal(rows.get("akinyi@example.com")?.referralAgentCode, "A1");
  assert.equal(rows.get("akinyi@example.com")?.termsAcceptedAt?.toISOString(), now.toISOString());
});

test("the phone cleanup script is a dry run until --apply, and documents the production commands", () => {
  const source = readFileSync(new URL("../../scripts/normalize-phones.mjs", import.meta.url), "utf8");
  assert.match(source, /--apply/);
  assert.match(source, /npx vercel env pull \.env\.production\.local/);
  assert.match(source, /node --env-file=\.env\.production\.local --import tsx scripts\/normalize-phones\.mjs/);
  assert.match(source, /node --env-file=\.env\.production\.local --import tsx scripts\/normalize-phones\.mjs --apply/);
  assert.match(source, /includes\("--apply"\)/);
  assert.equal(source.includes("vercel env add"), false);
  assert.equal(source.includes("vercel env rm"), false);
});
