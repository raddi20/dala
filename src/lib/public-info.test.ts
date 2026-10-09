import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage, { metadata as aboutMeta } from "@/app/about/page";
import ContactPage, { metadata as contactMeta } from "@/app/contact/page";
import FaqPage, { metadata as faqMeta } from "@/app/faq/page";
import PrivacyPage, { metadata as privacyMeta } from "@/app/privacy/page";
import RefundPage, { metadata as refundMeta } from "@/app/refund/page";
import TermsPage, { metadata as termsMeta } from "@/app/terms/page";
import { EntityContact } from "@/components/entity-contact";
import { Footer } from "@/components/footer";
import { CHARGE, FEATURED_DAYS, FREE_OFFERING_CAP, PRO_DAYS } from "@/lib/constants";
import { pricingRateNote } from "@/lib/pricing-display";
import {
  BUSINESS_ADDRESS,
  BUSINESS_PHONE,
  CONTACT_EMAIL,
  LEGAL_DRAFT_NOTE,
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_OWNER,
  LEGAL_ENTITY_REG_NO,
  LICENSED_PAYMENT_PROVIDER,
  PUBLIC_INFO_PAGES,
  PUBLIC_PAGES_UPDATED,
  VERIFIED_PRO_DAYS,
  featuredDurationCopy,
  legalEntityLabel,
  legalEntityOwnerLine,
  paidPriceLine,
  publicBusinessAddress,
  publicBusinessPhone,
  verifiedProDayCount,
  verifiedProDurationCopy,
} from "@/lib/public-info";
import { buildSitemap, staticPublicPaths } from "@/lib/sitemap-entries";
import { mayStoreResponse, navigationCacheKey, planRequest, servesStoredDocument } from "@/lib/sw-policy";

const origin = "https://www.rangach.co.ke";

test("about, faq, terms, and privacy are in the sitemap and the footer", () => {
  const paths = staticPublicPaths().map((item) => item.path);
  const pages = buildSitemap({ origin, shops: [], listings: [], people: [] });
  const urls = pages.map((page) => page.url);
  for (const page of PUBLIC_INFO_PAGES) {
    assert.ok(paths.includes(page.path), page.path);
    assert.ok(urls.includes(`${origin}${page.path}`), page.path);
    const row = pages.find((item) => item.url === `${origin}${page.path}`);
    assert.equal(row?.changeFrequency, "monthly");
    assert.equal(row?.priority, 0.5);
  }

  const footer = renderToStaticMarkup(createElement(Footer));
  for (const page of PUBLIC_INFO_PAGES) {
    assert.ok(footer.includes(`href="${page.path}"`), page.path);
    assert.ok(footer.includes(page.label), page.label);
  }
  for (const path of ["/contact", "/refund", "/terms", "/privacy"]) {
    assert.ok(footer.includes(`href="${path}"`), path);
  }
});

test("the four pages render, name themselves, and show the last-updated date", async () => {
  const cases = [
    { path: "/about", Page: AboutPage, meta: aboutMeta, needle: "The gateway to the Luo home" },
    { path: "/faq", Page: FaqPage, meta: faqMeta, needle: "not a verification badge" },
    { path: "/terms", Page: TermsPage, meta: termsMeta, needle: "laws of Kenya" },
    { path: "/privacy", Page: PrivacyPage, meta: privacyMeta, needle: "Kenya Data Protection Act 2019" },
  ] as const;

  for (const item of cases) {
    const defined = PUBLIC_INFO_PAGES.find((page) => page.path === item.path);
    assert.ok(defined);
    assert.equal(item.meta.title, defined.title);
    assert.equal(item.meta.description, defined.description);
    assert.ok(defined.description.length > 40);

    const html = renderToStaticMarkup(await item.Page());
    assert.match(html, new RegExp(`Last updated ${PUBLIC_PAGES_UPDATED.label}`));
    assert.match(html, new RegExp(item.needle));
    assert.ok(html.includes(`href="${CONTACT_EMAIL}"`) || html.includes(`mailto:${CONTACT_EMAIL}`));
  }
});

test("terms and privacy name Rangach Ltd and hide the company number until it is set", async () => {
  assert.equal(LEGAL_ENTITY_NAME, "Rangach Ltd");
  assert.equal(LEGAL_ENTITY_REG_NO, "");
  assert.equal(legalEntityLabel(), "Rangach Ltd");
  assert.equal(legalEntityLabel("Rangach Ltd", "PVT-123456"), "Rangach Ltd (company no. PVT-123456)");
  assert.equal(legalEntityLabel("Rangach Ltd", "  "), "Rangach Ltd");

  const terms = renderToStaticMarkup(await TermsPage());
  const privacy = renderToStaticMarkup(await PrivacyPage());
  assert.ok(terms.includes("Rangach Ltd"));
  assert.ok(privacy.includes("Rangach Ltd"));
  assert.equal(terms.includes("company no."), false);
  assert.equal(privacy.includes("company no."), false);
  assert.equal(terms.includes("[Rangach legal entity, TBC]"), false);
  assert.equal(privacy.includes("[Rangach legal entity, TBC]"), false);
  assert.equal(LEGAL_ENTITY_OWNER, "");
  assert.equal(legalEntityOwnerLine(), "");
  assert.equal(legalEntityOwnerLine("  "), "");
  assert.equal(legalEntityOwnerLine("Kevin Okullo"), "Owned by Kevin Okullo.");
  assert.equal(terms.includes("Owned by"), false);
  assert.equal(privacy.includes("Owned by"), false);
  assert.match(terms, /not legal advice/);
  assert.match(privacy, /not legal advice/);
  assert.equal(terms.includes(LEGAL_DRAFT_NOTE), true);
});

test("faq and terms use checkout prices and do not hardcode them", async () => {
  const faq = renderToStaticMarkup(await FaqPage());
  const terms = renderToStaticMarkup(await TermsPage());
  assert.match(faq, new RegExp(FREE_OFFERING_CAP.toString()));
  assert.ok(faq.includes(CHARGE.featured.Nairobi.label));
  assert.ok(faq.includes(CHARGE.featured.London.label));
  assert.ok(faq.includes(CHARGE.verified_pro.Nairobi.label));
  assert.ok(faq.includes(CHARGE.verified_pro.London.label));
  assert.equal(
    paidPriceLine("featured"),
    `${CHARGE.featured.Nairobi.label} in Nairobi and ${CHARGE.featured.London.label} for Diaspora shops`,
  );
  assert.equal(
    paidPriceLine("verified_pro"),
    `${CHARGE.verified_pro.Nairobi.label} in Nairobi and ${CHARGE.verified_pro.London.label} for Diaspora shops`,
  );
  assert.match(faq, /for Diaspora shops/);
  assert.match(faq, /Diaspora prices are pounds/);
  assert.match(faq, /a Diaspora price is paid by card/);
  assert.equal(faq.includes("in London"), false);
  assert.equal(terms.includes("in London"), false);
  assert.ok(terms.includes(paidPriceLine("featured")));
  assert.ok(terms.includes(paidPriceLine("verified_pro")));
  assert.match(faq, new RegExp(featuredDurationCopy()));
  assert.match(terms, /except where the law requires a refund/);

  for (const file of ["about/page.tsx", "faq/page.tsx", "terms/page.tsx", "privacy/page.tsx"]) {
    const source = readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8");
    assert.equal(source.includes("1,500"), false, file);
    assert.equal(source.includes("2,500"), false, file);
    assert.equal(source.includes("£12"), false, file);
    assert.equal(source.includes("£20"), false, file);
  }
});

test("pro duration is the renewable 30-day plan, and a lapse hides extras", async () => {
  assert.equal(PRO_DAYS, 30);
  assert.equal(VERIFIED_PRO_DAYS, PRO_DAYS);
  assert.equal(verifiedProDayCount(), 30);

  const copy = verifiedProDurationCopy();
  assert.match(copy, /paid plan, not a verification badge/);
  assert.match(copy, /lasts 30 days/);
  assert.match(copy, /adds another 30 days to that date/);
  assert.match(copy, /hidden, not deleted/);
  assert.equal(/open-ended|no end date|turns it off|starts another 30 days/i.test(copy), false);

  const unset = verifiedProDurationCopy(null);
  assert.match(unset, /paid plan, not a verification badge/);
  assert.match(unset, /adds another period of the same length to that date/);
  assert.match(unset, /hidden, not deleted/);
  assert.equal(/open-ended|no end date|turns it off/i.test(unset), false);

  assert.match(featuredDurationCopy(), new RegExp(`${FEATURED_DAYS} days`));

  const faq = renderToStaticMarkup(await FaqPage());
  const terms = renderToStaticMarkup(await TermsPage());
  const privacy = renderToStaticMarkup(await PrivacyPage());
  for (const html of [faq, terms, privacy]) {
    assert.ok(html.includes(copy));
    assert.equal(/open-ended|no end date|until Rangach turns it off/i.test(html), false);
  }
  assert.match(faq, /Renewing before the end date adds another 30 days to that date/);
});

test("empty phone, address, and owner constants render nothing", async () => {
  assert.equal(BUSINESS_PHONE, "");
  assert.equal(BUSINESS_ADDRESS, "");
  assert.equal(publicBusinessPhone(), "");
  assert.equal(publicBusinessPhone("   "), "");
  assert.equal(publicBusinessAddress(), "");
  assert.equal(publicBusinessAddress("  P.O. Box 1  "), "P.O. Box 1");
  assert.equal(publicBusinessPhone("+254700000111"), "+254700000111");

  const blank = renderToStaticMarkup(createElement(EntityContact));
  assert.equal(blank.includes("TODO"), false);
  assert.equal(blank.includes("Owned by"), false);
  assert.equal(blank.includes("tel:"), false);
  assert.match(blank, new RegExp(`mailto:${CONTACT_EMAIL}`));
  assert.ok(blank.includes(LEGAL_ENTITY_NAME));

  const filled = renderToStaticMarkup(
    createElement(EntityContact, {
      owner: legalEntityOwnerLine("Kevin Okullo"),
      address: "P.O. Box 1, Nairobi",
      phone: "+254700000111",
    }),
  );
  assert.match(filled, /Owned by Kevin Okullo/);
  assert.match(filled, /P\.O\. Box 1, Nairobi/);
  assert.match(filled, /tel:\+254700000111/);

  const contact = renderToStaticMarkup(await ContactPage());
  assert.equal(contactMeta.title, "Contact");
  assert.equal(contact.includes("TODO"), false);
  assert.equal(contact.includes("Owned by"), false);
  assert.equal(contact.includes("tel:"), false);
  assert.match(contact, new RegExp(`mailto:${CONTACT_EMAIL}`));
});

test("refund page is a draft and public policy pages do not name a processor or env vars", async () => {
  const refund = renderToStaticMarkup(await RefundPage());
  assert.equal(refundMeta.title, "Refunds");
  assert.match(refund, /not legal advice/);
  assert.ok(refund.includes(LEGAL_DRAFT_NOTE));
  assert.match(refund, /except where the law requires a refund|the law requires a refund/);
  assert.match(refund, /Neither plan renews by itself/);
  assert.match(refund, new RegExp(CONTACT_EMAIL));
  assert.match(refund, /5 business days/);
  assert.match(refund, /14 days/);
  assert.equal(refund.includes("TODO"), false);
  assert.equal(refund.includes("Flutterwave"), false);

  const pages = [
    "terms/page.tsx",
    "privacy/page.tsx",
    "faq/page.tsx",
    "pricing/page.tsx",
    "refund/page.tsx",
    "contact/page.tsx",
  ];
  const rendered = [
    renderToStaticMarkup(await TermsPage()),
    renderToStaticMarkup(await PrivacyPage()),
    renderToStaticMarkup(await FaqPage()),
    refund,
    renderToStaticMarkup(await ContactPage()),
    pricingRateNote(),
  ];
  for (const file of pages) {
    const source = readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8");
    assert.equal(/Flutterwave/i.test(source), false, file);
    assert.equal(/FX_/.test(source), false, file);
  }
  for (const html of rendered) {
    assert.equal(/Flutterwave/i.test(html), false);
    assert.equal(/FX_/.test(html), false);
  }
  assert.ok(rendered[2].includes(LICENSED_PAYMENT_PROVIDER));
});

test("Rangach Ltd is only hardcoded as LEGAL_ENTITY_NAME", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const paths = [join(root, "README.md"), ...walk(join(root, "src"))];
  const hits: string[] = [];
  for (const path of paths) {
    if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
    if (path.endsWith(`${join("src", "lib", "public-info.ts")}`)) continue;
    const source = readFileSync(path, "utf8");
    if (source.includes("Rangach Ltd")) hits.push(path.slice(root.length));
  }
  assert.deepEqual(hits, []);
  assert.equal(LEGAL_ENTITY_NAME, "Rangach Ltd");
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx|md)$/.test(name)) out.push(path);
  }
  return out;
}

test("the info pages stay network-only so the offline fallback is unchanged", () => {
  for (const page of PUBLIC_INFO_PAGES) {
    const navigation = planRequest({
      method: "GET",
      pathname: page.path,
      destination: "document",
      mode: "navigate",
      sameOrigin: true,
    });
    assert.equal(navigation.kind, "navigate", page.path);
    assert.equal(mayStoreResponse(navigation), false, page.path);
    assert.equal(servesStoredDocument(navigation), false, page.path);
    assert.equal(navigationCacheKey(page.path), null, page.path);
  }
});
