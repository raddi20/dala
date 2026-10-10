import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage from "@/app/about/page";
import FaqPage from "@/app/faq/page";
import RefundPage from "@/app/refund/page";
import TermsPage from "@/app/terms/page";
import { UpgradeAction } from "@/components/upgrade-action";
import { presentSellerTips, runWeeklySellerTips, type TipSeller } from "@/lib/ai/seller-tips";
import { PRO_DAYS } from "@/lib/constants";
import { PAID_UPGRADES_COMING_SOON, checkoutRefusal, paymentsLive } from "@/lib/payments/live";
import { prisma } from "@/lib/prisma";
import { setUserPro } from "@/lib/pro";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as NodeJS.ProcessEnv;
}

async function withFlag<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.PAYMENTS_LIVE;
  if (value === undefined) delete process.env.PAYMENTS_LIVE;
  else process.env.PAYMENTS_LIVE = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.PAYMENTS_LIVE;
    else process.env.PAYMENTS_LIVE = previous;
  }
}

test("PAYMENTS_LIVE is off unless it is 1, true, yes, or on", () => {
  for (const value of [undefined, "", "0", "false", "no", "off", "yes please"]) {
    const bag = env({});
    if (value !== undefined) bag.PAYMENTS_LIVE = value;
    assert.equal(paymentsLive(bag), false, String(value));
    assert.equal(checkoutRefusal(bag), PAID_UPGRADES_COMING_SOON);
  }
  for (const value of ["1", "true", "TRUE", " yes ", "on", "On"]) {
    assert.equal(paymentsLive(env({ PAYMENTS_LIVE: value })), true, value);
    assert.equal(checkoutRefusal(env({ PAYMENTS_LIVE: value })), null);
  }
});

test("upgrade controls hide the pay link while the flag is off and keep it when the flag is on", () => {
  const off = renderToStaticMarkup(
    createElement(UpgradeAction, { live: false, href: "/upgrade", label: "Continue on Promote", className: "pay" }),
  );
  assert.match(off, /Paid upgrades coming soon/);
  assert.equal(off.includes("href="), false);
  assert.equal(off.includes("Continue on Promote"), false);

  const on = renderToStaticMarkup(
    createElement(UpgradeAction, { live: true, href: "/upgrade?product=featured", label: "Continue on Promote", className: "pay" }),
  );
  assert.match(on, /href="\/upgrade\?product=featured"/);
  assert.match(on, /Continue on Promote/);
  assert.equal(on.includes(PAID_UPGRADES_COMING_SOON), false);
});

test("checkout creation refuses while the flag is off, and the webhook and return URL stay open", () => {
  const action = readFileSync(new URL("../actions/payments.ts", import.meta.url), "utf8");
  const gate = action.indexOf("checkoutRefusal");
  const create = action.indexOf("prisma.payment.create");
  assert.ok(gate >= 0 && create > gate);

  const webhook = readFileSync(new URL("../../app/api/payments/flutterwave/route.ts", import.meta.url), "utf8");
  const back = readFileSync(new URL("../../app/upgrade/return/page.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../../components/pay-form.tsx", import.meta.url), "utf8");
  assert.equal(webhook.includes("PAYMENTS_LIVE"), false);
  assert.equal(webhook.includes("checkoutRefusal"), false);
  assert.equal(back.includes("PAYMENTS_LIVE"), false);
  assert.match(form, /M-Pesa/);
  assert.match(form, /Pay \$\{charge\.label\}/);
});

test("public pages hide the pay invitation when the flag is off and keep it when the flag is on", async () => {
  const off = await withFlag(undefined, async () => ({
    faq: renderToStaticMarkup(await FaqPage()),
    terms: renderToStaticMarkup(await TermsPage()),
    refund: renderToStaticMarkup(await RefundPage()),
    about: renderToStaticMarkup(AboutPage()),
  }));
  for (const html of [off.faq, off.terms, off.refund, off.about]) {
    assert.match(html, /Paid upgrades coming soon/);
  }
  assert.equal(off.faq.includes("can be M-Pesa or a"), false);
  assert.equal(off.faq.includes("a Diaspora price is paid by card"), false);
  assert.equal(off.terms.includes("You pay the price shown at checkout"), false);
  assert.equal(off.terms.includes("by M-Pesa where the price"), false);
  assert.equal(off.refund.includes("unless you start a new payment"), false);
  assert.equal(off.about.includes("can pay for Featured"), false);

  const on = await withFlag("1", async () => ({
    faq: renderToStaticMarkup(await FaqPage()),
    terms: renderToStaticMarkup(await TermsPage()),
    refund: renderToStaticMarkup(await RefundPage()),
    about: renderToStaticMarkup(AboutPage()),
  }));
  assert.match(on.faq, /can be M-Pesa or a/);
  assert.match(on.faq, /Diaspora prices are pounds/);
  assert.match(on.faq, /a Diaspora price is paid by card/);
  assert.match(on.terms, /You pay the price shown at checkout/);
  assert.match(on.terms, /by M-Pesa where the/);
  assert.match(on.refund, /unless you start a new payment/);
  assert.match(on.about, /can pay for Featured/);
  assert.equal(on.faq.includes(PAID_UPGRADES_COMING_SOON), false);
});

test("the pricing page keeps the prices and labels them coming soon", () => {
  const pricing = readFileSync(new URL("../../app/pricing/page.tsx", import.meta.url), "utf8");
  assert.match(pricing, /Coming soon/);
  assert.match(pricing, /UpgradeAction/);
  assert.match(pricing, /price\.label/);
  assert.match(pricing, /Continue on Promote/);
});

test("admin grants do not consult the payments flag", async () => {
  const admin = readFileSync(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../actions/admin.ts", import.meta.url), "utf8");
  const pro = readFileSync(new URL("../pro.ts", import.meta.url), "utf8");
  const badges = readFileSync(new URL("../shop-badge-commit.ts", import.meta.url), "utf8");
  assert.match(admin, /Grant Pro plan/);
  assert.match(admin, /Add \$\{PRO_DAYS\} days/);
  assert.match(admin, /Remove Pro plan/);
  assert.match(admin, /Grant verified/);
  assert.equal(actions.includes("PAYMENTS_LIVE"), false);
  assert.equal(pro.includes("PAYMENTS_LIVE"), false);
  assert.equal(badges.includes("PAYMENTS_LIVE"), false);

  delete process.env.PAYMENTS_LIVE;
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: { email: `grant-${stamp}@example.com`, name: "Grant Test", passwordHash: "x" },
  });
  try {
    const now = new Date("2026-10-09T00:00:00.000Z");
    const granted = await setUserPro(prisma, user.id, true, now);
    assert.equal(granted?.verifiedPro, true);
    assert.equal(granted?.verifiedProUntil?.toISOString(), new Date(now.getTime() + PRO_DAYS * 86_400_000).toISOString());
    const removed = await setUserPro(prisma, user.id, false, now);
    assert.equal(removed?.verifiedPro, false);
    assert.equal(removed?.verifiedProUntil, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("weekly tip emails do not invite an upgrade while payments are off", async () => {
  const upgrade = { title: "Get Featured", body: "12 views and 1 tap.", action: "upgrade_featured" as const };
  const seller: TipSeller = {
    userId: "user_1",
    email: "amina@example.com",
    name: "Amina",
    storefrontId: "shop_1",
    tipsEmailOptIn: true,
    alreadySent: false,
    statsJson: "{}",
  };
  const kept = presentSellerTips({ summary: "A quiet week.", tips: [upgrade] }, env({ PAYMENTS_LIVE: "1" }));
  const dropped = presentSellerTips({ summary: "A quiet week.", tips: [upgrade] }, env({}));
  assert.equal(kept.tips.length, 1);
  assert.equal(dropped.tips.length, 0);

  const run = async () => ({
    ok: true as const,
    data: { summary: "A quiet week.", tips: [upgrade] },
    provider: "mock" as const,
    model: "mock",
    costMicroUsd: 0,
    latencyMs: 1,
  });
  const mail = env({
    TIPS_EMAIL: "1",
    ZEPTOMAIL_TOKEN: "zoho-token",
    EMAIL_FROM: "Rangach <hello@rangach.co.ke>",
    CRON_SECRET: "long-secret",
  });
  let offSends = 0;
  const off = await runWeeklySellerTips({
    env: mail,
    featureOn: async () => true,
    sellers: [seller],
    purge: async () => 0,
    run,
    send: async () => {
      offSends += 1;
      return "sent";
    },
    save: async () => undefined,
  });
  assert.equal(off.drafted, 0);
  assert.equal(offSends, 0);

  let onText = "";
  const on = await runWeeklySellerTips({
    env: { ...mail, PAYMENTS_LIVE: "1" },
    featureOn: async () => true,
    sellers: [seller],
    purge: async () => 0,
    run,
    send: async (message) => {
      onText = message.text;
      return "sent";
    },
    save: async () => undefined,
    markEmailed: async () => undefined,
  });
  assert.equal(on.emailed, 1);
  assert.match(onText, /Get Featured/);
});
