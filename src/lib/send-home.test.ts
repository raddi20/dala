import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { backBarTitle } from "@/lib/back-nav";
import { DIASPORA_WAITLIST_LIMIT, limitDiasporaWaitlist, type MemoryBucket } from "@/lib/rate-limit";
import {
  SEND_HOME_BASKETS,
  SEND_HOME_LIMIT_MESSAGE,
  basketPriceLabel,
  countLabels,
  isListedPilot,
  parseWaitlist,
  savePilotFlag,
  takeWaitlist,
  waitlistCsv,
  type WaitlistDraft,
  type WaitlistFields,
} from "@/lib/send-home";
import { staticPublicPaths } from "@/lib/sitemap-entries";

const money = { country: "KE" as string | null, rates: { USD: 1, KES: 129, GBP: 0.75 }, kesPerUsd: 129, kesPerGbp: 170 };

function fields(overrides: Partial<WaitlistFields> = {}): WaitlistFields {
  return {
    name: "Akinyi",
    email: "Akinyi@Example.com",
    country: "gb",
    countryOther: "",
    homeArea: "kisumu",
    homeAreaOther: "",
    baskets: ["grocery-3000", "tilapia"],
    whatsapp: "",
    consent: "1",
    ...overrides,
  };
}

test("basket labels follow the visitor currency and unnamed baskets stay words", () => {
  const grocery = SEND_HOME_BASKETS[0];
  const tilapia = SEND_HOME_BASKETS.find((basket) => basket.id === "tilapia");
  assert.ok(grocery && tilapia);
  assert.equal(basketPriceLabel(grocery, money), "Grocery basket · KES 3,000");
  assert.equal(basketPriceLabel(grocery, { ...money, country: "US" }), "Grocery basket · ≈ $23");
  assert.equal(basketPriceLabel(grocery, { ...money, country: "GB" }), "Grocery basket · £18");
  assert.equal(basketPriceLabel(tilapia, money), "Fresh tilapia");
  assert.equal(SEND_HOME_BASKETS.some((basket) => /funeral/i.test(basket.name)), false);
});

test("a consented sign-up stores the email, baskets, and an optional WhatsApp number", async () => {
  const saved: WaitlistDraft[] = [];
  const result = await takeWaitlist({
    fields: fields({ whatsapp: "0712 345 678", country: "other", countryOther: "Sweden" }),
    ip: "203.0.113.44",
    now: new Date("2026-10-14T12:00:00.000Z"),
    limit: async () => false,
    create: async (draft) => {
      saved.push(draft);
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(saved[0]?.email, "akinyi@example.com");
  assert.equal(saved[0]?.country, "Sweden");
  assert.equal(saved[0]?.homeArea, "Kisumu");
  assert.equal(saved[0]?.baskets, "grocery-3000,tilapia");
  assert.equal(saved[0]?.whatsapp, "+254712345678");
  assert.equal(JSON.stringify(saved[0]).includes("203.0.113.44"), false);
});

test("consent, a bad email, and the rate limit do not save a row", async () => {
  let creates = 0;
  const create = async () => {
    creates += 1;
  };
  const noConsent = await takeWaitlist({
    fields: fields({ consent: "" }),
    ip: "203.0.113.44",
    limit: async () => false,
    create,
  });
  assert.equal(noConsent.ok, false);
  const badEmail = parseWaitlist(fields({ email: "not-an-email" }));
  assert.equal(badEmail.ok, false);
  const limited = await takeWaitlist({
    fields: fields(),
    ip: "203.0.113.44",
    limit: async () => true,
    create,
  });
  assert.deepEqual(limited, { ok: false, error: SEND_HOME_LIMIT_MESSAGE });
  assert.equal(creates, 0);
});

test("the waitlist limiter hashes the IP", async () => {
  const memory = new Map<string, MemoryBucket>();
  const now = 1_700_000_000_000;
  const ip = "203.0.113.50";
  for (let i = 0; i < DIASPORA_WAITLIST_LIMIT; i += 1) {
    assert.equal(await limitDiasporaWaitlist(ip, { memory, durable: null, now }), false);
  }
  assert.equal(await limitDiasporaWaitlist(ip, { memory, durable: null, now }), true);
  const key = [...memory.keys()][0] ?? "";
  assert.equal(key.startsWith("diaspora_waitlist:"), true);
  assert.equal(key.includes(ip), false);
});

test("pilot toggles are audited once, and only a public pilot shop is listed", async () => {
  const audits: string[] = [];
  let shop = { id: "shop_1", sendHomePilot: false, slug: "tilapia", userId: "user_1" };
  const on = await savePilotFlag({
    id: "shop_1",
    on: true,
    find: async () => shop,
    update: async (_id, next) => {
      shop = { ...shop, sendHomePilot: next };
    },
    audit: async (entry) => {
      audits.push(entry.action);
    },
  });
  assert.equal(on.ok && on.changed, true);
  assert.deepEqual(audits, ["shop.send_home_on"]);
  const same = await savePilotFlag({
    id: "shop_1",
    on: true,
    find: async () => shop,
    update: async () => {
      throw new Error("no update");
    },
    audit: async () => {
      throw new Error("no audit");
    },
  });
  assert.deepEqual(same, { ok: true, changed: false });
  assert.equal(
    isListedPilot({ sendHomePilot: true, published: true, hidden: false, ownerSuspended: false }),
    true,
  );
  assert.equal(
    isListedPilot({ sendHomePilot: true, published: false, hidden: false, ownerSuspended: false }),
    false,
  );
  assert.equal(
    isListedPilot({ sendHomePilot: false, published: true, hidden: false, ownerSuspended: false }),
    false,
  );
});

test("counts and CSV group the waitlist without a payment column", () => {
  const counts = countLabels([
    { label: "United Kingdom" },
    { label: "United Kingdom" },
    { label: "Kisumu" },
  ]);
  assert.equal(counts[0]?.label, "United Kingdom");
  assert.equal(counts[0]?.count, 2);
  const csv = waitlistCsv([
    {
      id: "row_1",
      createdAt: new Date("2026-10-14T12:00:00.000Z"),
      name: "Akinyi Odhiambo",
      email: "akinyi@example.com",
      country: "United Kingdom",
      homeArea: "Kisumu",
      baskets: "tilapia,ayie",
      whatsapp: "+254712345678",
      consentAt: new Date("2026-10-14T12:00:00.000Z"),
    },
  ]);
  assert.match(csv, /^id,createdAt,name,email,country,homeArea,baskets,whatsapp,consentAt/);
  assert.match(csv, /'\+254712345678/);
  assert.equal(/card|paystack|amount/i.test(csv.split("\r\n")[0] ?? ""), false);
  assert.equal(backBarTitle({ pathname: "/send-home" }), "Send home");
  assert.equal(backBarTitle({ pathname: "/admin/send-home" }), "Send-home waitlist");
  assert.ok(staticPublicPaths().some((item) => item.path === "/send-home"));

  const page = readFileSync(new URL("../app/send-home/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../components/send-home-form.tsx", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  for (const source of [page, form]) {
    assert.equal(/funeral/i.test(source), false);
    assert.equal(/escrow/i.test(source), false);
    assert.equal(/paystack/i.test(source), false);
    assert.equal(/checkout/i.test(source), false);
  }
  assert.match(page, /Kenya, East Africa and the Diaspora|AUDIENCE_LINE/);
  assert.match(page, /Oor chiemo dala/);
  assert.equal(page.includes("Chiemo · dala"), false);
  assert.equal(page.includes("Hii ni orodha ya kusubiri."), false);
  assert.match(page, /Tuma chakula nyumbani\. Hatuchukui oda ya kadi bado\./);
  assert.match(form, /href="\/privacy"/);
  assert.match(schema, /sendHomePilot\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /model DiasporaWaitlist/);
  assert.match(schema, /model Order \{/);
  assert.equal(/escrow/i.test(schema), false);
});
