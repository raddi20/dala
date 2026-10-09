import assert from "node:assert/strict";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import { AgentCountTable } from "@/components/admin-agent-counts";
import { Footer } from "@/components/footer";
import { ListGuide } from "@/components/list-guide";
import { WelcomeGuide } from "@/components/welcome-guide";
import { AGENT_COOKIE, AGENT_COOKIE_DAYS } from "@/lib/agent-code";
import { CHARGE } from "@/lib/constants";
import {
  LAUNCH_ROUTES,
  LIST_DESCRIPTION,
  LIST_PATH,
  LIST_TITLE,
  SIGNED_OUT_PROGRESS,
  WELCOME_DESCRIPTION,
  WELCOME_PATH,
  WELCOME_TITLE,
  guideCurrentStep,
  type GuideProgress,
} from "@/lib/launch-pages";
import { CONTACT_EMAIL, publicBusinessPhone, publicBusinessPhoneTel } from "@/lib/public-info";
import { buildShareMetadata } from "@/lib/share-metadata";
import { buildSitemap, staticPublicPaths } from "@/lib/sitemap-entries";
import { MAX_DURATION_SECONDS } from "@/lib/video/constants";

const origin = "https://www.rangach.co.ke";

const PRICE_MARKERS = [
  CHARGE.featured.Nairobi.label,
  CHARGE.featured.London.label,
  CHARGE.verified_pro.Nairobi.label,
  CHARGE.verified_pro.London.label,
  "£",
  "$",
  "KES",
  "GBP",
  "USD",
  "1,500",
  "2,500",
  "1500",
  "2500",
];

function assertNoPaidPitch(html: string, label: string) {
  for (const marker of PRICE_MARKERS) {
    assert.equal(html.includes(marker), false, `${label} includes ${marker}`);
  }
  assert.equal(html.toLowerCase().includes("buy now"), false, label);
  assert.equal(html.toLowerCase().includes("get verified pro"), false, label);
  assert.ok(html.includes("Paid upgrades coming soon"), label);
}

test("welcome and list render, link from the footer, and sit in the sitemap", () => {
  const welcome = renderToStaticMarkup(createElement(WelcomeGuide));
  const list = renderToStaticMarkup(createElement(ListGuide, { progress: SIGNED_OUT_PROGRESS, listingWriter: false }));
  const footer = renderToStaticMarkup(createElement(Footer));

  assert.match(welcome, /Learn about Rangach/);
  assert.match(welcome, /gateway to the Luo home/);
  assert.match(welcome, /diaspora buying for family back home/i);
  assert.ok(welcome.includes(CONTACT_EMAIL));
  assert.ok(welcome.includes(publicBusinessPhone()));
  assert.ok(welcome.includes(`href="tel:${publicBusinessPhoneTel()}"`));
  assert.ok(welcome.includes(`href="${LIST_PATH}"`));
  assert.ok(welcome.includes(`href="${LAUNCH_ROUTES.occasions}"`));
  assert.ok(welcome.includes("List your business free"));

  assert.match(list, /List your business/);
  assert.ok(list.includes(`href="${LAUNCH_ROUTES.registerReturn}"`));
  assert.ok(list.includes(`href="${LAUNCH_ROUTES.shop}"`));
  assert.ok(list.includes(`href="${LAUNCH_ROUTES.listing}"`));
  assert.ok(list.includes(`href="${LAUNCH_ROUTES.whatsapp}"`));
  assert.ok(list.includes(`href="${LAUNCH_ROUTES.video}"`));
  assert.ok(list.includes("What you need"));
  assert.ok(list.includes("3–5 good photos"));
  assert.ok(list.includes("Photo tips"));
  assert.ok(list.includes("Listing assist"));
  assert.equal(list.includes("Write it for me"), false);
  assert.ok(list.includes(String(MAX_DURATION_SECONDS)));
  assert.ok(list.includes("Verified Pro"));
  assert.equal(list.includes('aria-current="step"'), false);

  assert.ok(footer.includes('href="/welcome"'));
  assert.ok(footer.includes("Learn about Rangach"));
  assert.ok(footer.includes('href="/list"'));
  assert.ok(footer.includes("List your business"));
  assert.ok(footer.includes('href="/listings/new"'));

  assertNoPaidPitch(welcome, "welcome");
  assertNoPaidPitch(list, "list");
  assert.equal(WELCOME_DESCRIPTION.includes("KES"), false);
  assert.equal(LIST_DESCRIPTION.includes("£"), false);

  const paths = staticPublicPaths().map((item) => item.path);
  assert.ok(paths.includes(WELCOME_PATH));
  assert.ok(paths.includes(LIST_PATH));
  const pages = buildSitemap({ origin, shops: [], listings: [], people: [] });
  for (const path of [WELCOME_PATH, LIST_PATH]) {
    const row = pages.find((item) => item.url === `${origin}${path}`);
    assert.ok(row, path);
    assert.equal(row?.priority, 0.8);
  }

  const welcomeMeta = buildShareMetadata({
    origin,
    path: WELCOME_PATH,
    title: WELCOME_TITLE,
    description: WELCOME_DESCRIPTION,
    image: "/welcome/opengraph-image",
    imageAlt: WELCOME_TITLE,
  });
  const listMeta = buildShareMetadata({
    origin,
    path: LIST_PATH,
    title: LIST_TITLE,
    description: LIST_DESCRIPTION,
    image: "/list/opengraph-image",
    imageAlt: LIST_TITLE,
  });
  assert.equal(welcomeMeta.title, WELCOME_TITLE);
  assert.equal(listMeta.openGraph?.url, `${origin}${LIST_PATH}`);
  const twitter = listMeta.twitter as { card?: string } | null | undefined;
  assert.equal(twitter?.card, "summary_large_image");
});

test("the listing writer is mentioned only when it is enabled", () => {
  const on = renderToStaticMarkup(createElement(ListGuide, { progress: SIGNED_OUT_PROGRESS, listingWriter: true }));
  assert.ok(on.includes("Write it for me"));
  assertNoPaidPitch(on, "list with writer");
});

test("a signed-in seller is pointed at the unfinished step", () => {
  const shopNext: GuideProgress = {
    signedIn: true,
    hasShop: false,
    hasOffering: false,
    shopPublished: false,
    hasListing: false,
    hasWhatsapp: false,
  };
  assert.equal(guideCurrentStep(shopNext), "shop");
  const shopHtml = renderToStaticMarkup(createElement(ListGuide, { progress: shopNext, listingWriter: false }));
  assert.ok(shopHtml.includes('id="step-shop"'));
  assert.match(shopHtml, /aria-current="step"/);
  assert.ok(shopHtml.includes("Start here"));
  assert.ok(shopHtml.includes("Set up the shop"));
  assert.ok(shopHtml.includes("Done"));

  const listingNext: GuideProgress = { ...shopNext, hasShop: true, hasOffering: false };
  assert.equal(guideCurrentStep(listingNext), "listing");
  const listingHtml = renderToStaticMarkup(createElement(ListGuide, { progress: listingNext, listingWriter: false }));
  assert.ok(listingHtml.includes(`href="${LAUNCH_ROUTES.offering}"`));
  assert.ok(listingHtml.includes("Add your first offering"));
  assert.ok(listingHtml.includes(`href="${LAUNCH_ROUTES.listing}"`));

  const whatsappNext: GuideProgress = { ...listingNext, hasOffering: true, hasListing: true };
  assert.equal(guideCurrentStep(whatsappNext), "whatsapp");

  const publishNext: GuideProgress = { ...whatsappNext, hasWhatsapp: true };
  assert.equal(guideCurrentStep(publishNext), "live");
  const publishHtml = renderToStaticMarkup(createElement(ListGuide, { progress: publishNext, listingWriter: false }));
  assert.ok(publishHtml.includes("Publish your shop"));

  const finished: GuideProgress = { ...publishNext, shopPublished: true };
  assert.equal(guideCurrentStep(finished), null);
  assert.equal(guideCurrentStep(SIGNED_OUT_PROGRESS), null);
});

test("privacy names the agent cookie", () => {
  const html = renderToStaticMarkup(createElement(PrivacyPage));
  assert.ok(html.includes(AGENT_COOKIE));
  assert.ok(html.includes(String(AGENT_COOKIE_DAYS)));
  assert.match(html, /do not store your IP address or a device id/i);
  assert.match(html, /do not overwrite/i);
});

test("the admin table shows agent counts including none", () => {
  const html = renderToStaticMarkup(
    createElement(AgentCountTable, {
      rows: [
        { code: "A1", signups: 4, shops: 3, firstListings: 2 },
        { code: "none", signups: 1, shops: 0, firstListings: 0 },
      ],
    }),
  );
  assert.match(html, /Field agents/);
  assert.ok(html.includes("A1"));
  assert.ok(html.includes("none"));
  assert.ok(html.includes(">4<"));
  assert.ok(html.includes(">3<"));
  assert.ok(html.includes(">2<"));
});
