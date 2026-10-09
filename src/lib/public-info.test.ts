import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage, { metadata as aboutMeta } from "@/app/about/page";
import FaqPage, { metadata as faqMeta } from "@/app/faq/page";
import PrivacyPage, { metadata as privacyMeta } from "@/app/privacy/page";
import TermsPage, { metadata as termsMeta } from "@/app/terms/page";
import { Footer } from "@/components/footer";
import { CHARGE, FEATURED_DAYS, FREE_OFFERING_CAP, PRO_DAYS } from "@/lib/constants";
import {
  CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_REG_NO,
  PUBLIC_INFO_PAGES,
  PUBLIC_PAGES_UPDATED,
  VERIFIED_PRO_DAYS,
  featuredDurationCopy,
  legalEntityLabel,
  paidPriceLine,
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
    `${CHARGE.featured.Nairobi.label} for shops in Kenya and East Africa and ${CHARGE.featured.London.label} for Diaspora shops`,
  );
  assert.equal(
    paidPriceLine("verified_pro"),
    `${CHARGE.verified_pro.Nairobi.label} for shops in Kenya and East Africa and ${CHARGE.verified_pro.London.label} for Diaspora shops`,
  );
  assert.match(faq, /for shops in Kenya and East Africa/);
  assert.equal(faq.includes("in Nairobi"), false);
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
