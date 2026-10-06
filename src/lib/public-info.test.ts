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
import { CHARGE, FEATURED_DAYS, FREE_OFFERING_CAP } from "@/lib/constants";
import {
  CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  PUBLIC_INFO_PAGES,
  PUBLIC_PAGES_UPDATED,
  featuredDurationCopy,
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

test("terms and privacy show the legal-entity placeholder in one shared constant", async () => {
  assert.equal(LEGAL_ENTITY_NAME, "[Rangach legal entity, TBC]");
  const terms = renderToStaticMarkup(await TermsPage());
  const privacy = renderToStaticMarkup(await PrivacyPage());
  assert.ok(terms.includes(LEGAL_ENTITY_NAME));
  assert.ok(privacy.includes(LEGAL_ENTITY_NAME));
  assert.equal(terms.split(LEGAL_ENTITY_NAME).length - 1 >= 1, true);
});

test("faq and terms use checkout prices and do not hardcode them", async () => {
  const faq = renderToStaticMarkup(await FaqPage());
  const terms = renderToStaticMarkup(await TermsPage());
  assert.match(faq, new RegExp(FREE_OFFERING_CAP.toString()));
  assert.ok(faq.includes(CHARGE.featured.Nairobi.label));
  assert.ok(faq.includes(CHARGE.featured.London.label));
  assert.ok(faq.includes(CHARGE.verified_pro.Nairobi.label));
  assert.ok(faq.includes(CHARGE.verified_pro.London.label));
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

test("pro duration stays true with or without a day count", () => {
  assert.equal(verifiedProDayCount(), null);
  const open = verifiedProDurationCopy(null);
  assert.match(open, /paid plan, not a verification badge/);
  assert.match(open, /open-ended/);
  assert.match(open, /set number of days/);
  assert.equal(open.includes("30 days"), false);

  const renewable = verifiedProDurationCopy(30);
  assert.match(renewable, /paid plan, not a verification badge/);
  assert.match(renewable, /lasts 30 days/);
  assert.match(renewable, /another 30 days/);
  assert.match(featuredDurationCopy(), new RegExp(`${FEATURED_DAYS} days`));
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
