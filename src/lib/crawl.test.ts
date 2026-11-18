import assert from "node:assert/strict";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingLinkList } from "@/components/listing-link-list";
import { categoryHref } from "@/lib/categories";
import {
  hubDescription,
  hubIntro,
  hubSampleLine,
  listingDetailsSentence,
  listingPageTitle,
  shopAboutFallback,
  shopPageTitle,
  shownPriceLabel,
} from "@/lib/crawl-copy";
import {
  chunkSitemap,
  hubIndexable,
  hubLinksFromCounts,
  hubRobots,
  indexableCategories,
  indexableTownPages,
  shouldListListing,
  shouldListShop,
} from "@/lib/crawl-index";
import { selectRelatedListings } from "@/lib/related-listings";
import { buildSitemap } from "@/lib/sitemap-entries";
import { renderSitemapIndex, renderSitemapUrlset } from "@/lib/sitemap-xml";
import { townPage } from "@/lib/seo";

const origin = "https://www.rangach.co.ke";

test("shop description fallback uses only the fields it is given", () => {
  const full = shopAboutFallback({
    name: "Achieng",
    category: "Catering",
    town: "Kisumu",
    listingCount: 4,
    siteName: "Rangach",
  });
  assert.equal(full, "Achieng is a Catering business in Kisumu on Rangach with 4 listings.");

  const sparse = shopAboutFallback({
    name: "Achieng",
    category: "",
    town: "",
    listingCount: 0,
    siteName: "Rangach",
  });
  assert.equal(sparse, "Achieng is a business on Rangach with 0 listings.");
  assert.doesNotMatch(sparse, /Kisumu|Catering|review|rating|star|Ksh|funeral|escrow/i);

  const funeralCategory = shopAboutFallback({
    name: "Achieng",
    category: "Funerals & memorials",
    town: "Siaya",
    listingCount: 1,
    siteName: "Rangach",
  });
  assert.equal(funeralCategory, "Achieng is a business in Siaya on Rangach with 1 listing.");
  assert.doesNotMatch(funeralCategory, /funeral|escrow/i);
  assert.doesNotMatch(`${full} ${sparse} ${funeralCategory}`, /review|rating|stars?/i);
});

test("listing details and hub text stay inside real fields", () => {
  const details = listingDetailsSentence({
    title: "Lunch plate",
    category: "Food & restaurants",
    city: "Nairobi",
    siteName: "Rangach",
    sellerName: "Atieno Odhiambo",
    priceLabel: "500",
  });
  assert.equal(
    details,
    "Lunch plate is a Food & restaurants listing in Nairobi on Rangach. Listed by Atieno Odhiambo. Price: Ksh 500.",
  );
  assert.equal(shownPriceLabel("From KES 450"), "From KES 450");
  assert.equal(shownPriceLabel(""), "");
  const noPrice = listingDetailsSentence({
    title: "Lunch plate",
    category: "",
    city: "",
    siteName: "Rangach",
    sellerName: "",
    priceLabel: "",
  });
  assert.equal(noPrice, "Lunch plate is a listing on Rangach.");
  assert.doesNotMatch(noPrice, /Ksh|review|rating|Nairobi|Atieno/);

  const intro = hubIntro({ placeName: "Nairobi", siteName: "Rangach", shopCount: 1, listingCount: 2 });
  assert.equal(intro, "Nairobi on Rangach has 1 shop and 2 listings.");
  assert.equal(hubSampleLine(["Tilapia", "Ugali"]), "Listings include Tilapia, Ugali.");
  assert.equal(hubSampleLine([]), "");
  const described = hubDescription({
    placeName: "Food & restaurants",
    siteName: "Rangach",
    shopCount: 0,
    listingCount: 0,
  });
  assert.equal(described, "Food & restaurants on Rangach has 0 shops and 0 listings.");
  assert.doesNotMatch(`${intro} ${described}`, /funeral|escrow|review|rating/i);

  assert.equal(shopPageTitle({ name: "Atieno", category: "Catering", town: "Kisumu" }), "Atieno · Catering · Kisumu");
  assert.equal(listingPageTitle({ title: "Lunch plate", category: "Food & restaurants", city: "Nairobi" }), "Lunch plate · Food & restaurants · Nairobi");
});

test("related listings prefer the same category and town, and skip everything else", () => {
  const older = new Date("2026-01-01T00:00:00.000Z");
  const newer = new Date("2026-06-01T00:00:00.000Z");
  const current = { id: "self", category: "Catering", city: "Kisumu" };
  const picked = selectRelatedListings(
    current,
    [
      { id: "self", title: "Me", category: "Catering", city: "Kisumu", updatedAt: newer },
      { id: "town-only", title: "Town", category: "Transport & logistics", city: "Kisumu", updatedAt: newer },
      { id: "both-old", title: "Both old", category: "Catering", city: "Kisumu", updatedAt: older },
      { id: "both-new", title: "Both new", category: "Catering", city: "Kisumu", updatedAt: newer },
      { id: "category-only", title: "Category", category: "Catering", city: "Nairobi", updatedAt: older },
      { id: "neither", title: "Neither", category: "Retail / shops", city: "London", updatedAt: newer },
    ],
    8,
  );
  assert.deepEqual(
    picked.map((item) => item.id),
    ["both-new", "both-old", "category-only", "town-only"],
  );
  assert.equal(selectRelatedListings(current, picked, 2).length, 2);
  assert.deepEqual(selectRelatedListings({ id: "x", category: "", city: "" }, picked), []);
});

test("empty hubs are noindex and non-empty hubs stay indexable", () => {
  assert.equal(hubIndexable(0, 0), false);
  assert.deepEqual(hubRobots(0, 0), { index: false, follow: true });
  assert.equal(hubRobots(1, 0).index, true);
  assert.equal(hubRobots(0, 3).index, true);
});

test("sitemap lists public shops and listings, drops empty hubs, and keeps lastmod", () => {
  const shopAt = new Date("2026-08-01T00:00:00.000Z");
  const listingAt = new Date("2026-09-01T00:00:00.000Z");
  const kisumu = townPage("kisumu");
  assert.ok(kisumu);
  const pages = buildSitemap({
    origin,
    shops: [{ slug: "real-shop", updatedAt: shopAt }],
    listings: [{ id: "list_9", updatedAt: listingAt }],
    people: [],
    towns: [{ ...kisumu, updatedAt: listingAt }],
    categories: [{ name: "Food & restaurants", updatedAt: shopAt }],
  });
  const urls = pages.map((page) => page.url);
  assert.ok(urls.includes(`${origin}/b/real-shop`));
  assert.ok(urls.includes(`${origin}/listings/list_9`));
  assert.ok(urls.includes(`${origin}/places/kisumu`));
  assert.ok(urls.includes(`${origin}${categoryHref("Food & restaurants")}`));
  assert.equal(urls.includes(`${origin}${categoryHref("Beauty & personal care")}`), false);
  assert.equal(urls.includes(`${origin}/places/siaya`), false);
  assert.equal(urls.includes(`${origin}/places/homa-bay`), false);
  const shop = pages.find((page) => page.url.endsWith("/b/real-shop"));
  const town = pages.find((page) => page.url.endsWith("/places/kisumu"));
  const category = pages.find((page) => page.url.includes("Food"));
  assert.equal(new Date(shop?.lastModified ?? 0).toISOString(), shopAt.toISOString());
  assert.equal(new Date(town?.lastModified ?? 0).toISOString(), listingAt.toISOString());
  assert.equal(new Date(category?.lastModified ?? 0).toISOString(), shopAt.toISOString());
});

test("hidden, unpublished, suspended, and flagged demo rows stay out of the sitemap", () => {
  const live = { published: true, hidden: false, ownerSuspended: false, ownerEmail: "seller@rangach.co.ke" };
  assert.equal(shouldListShop(live, { HIDE_DEMO_SHOPS: "1" }), true);
  assert.equal(shouldListShop({ ...live, hidden: true }, {}), false);
  assert.equal(shouldListShop({ ...live, published: false }, {}), false);
  assert.equal(shouldListShop({ ...live, ownerSuspended: true }, {}), false);
  assert.equal(shouldListShop({ ...live, ownerEmail: "atieno@dala.local" }, { HIDE_DEMO_SHOPS: "1" }), false);
  assert.equal(shouldListShop({ ...live, ownerEmail: "atieno@dala.local" }, { HIDE_DEMO_SHOPS: "" }), true);
  assert.equal(shouldListListing({ hidden: false, ownerSuspended: false, ownerEmail: "seller@rangach.co.ke" }, {}), true);
  assert.equal(shouldListListing({ hidden: true, ownerSuspended: false, ownerEmail: "seller@rangach.co.ke" }, {}), false);
  assert.equal(
    shouldListListing({ hidden: false, ownerSuspended: false, ownerEmail: "atieno@dala.local" }, { HIDE_DEMO_SHOPS: "yes" }),
    false,
  );
});

test("hub indexes ignore empty towns and categories and rank the busiest links", () => {
  const at = new Date("2026-03-01T00:00:00.000Z");
  const categories = indexableCategories({
    listings: [{ category: "Catering", updatedAt: at }],
    shops: [{ categories: ["Food & restaurants", "Catering"], updatedAt: at }],
  });
  assert.deepEqual(
    categories.map((row) => row.name),
    ["Catering", "Food & restaurants"],
  );
  assert.equal(categories.find((row) => row.name === "Catering")?.shopCount, 1);
  assert.equal(categories.find((row) => row.name === "Catering")?.listingCount, 1);

  const towns = indexableTownPages({
    listings: [{ city: "Nairobi", updatedAt: at }],
    shops: [{ towns: ["London"], updatedAt: at }],
  });
  assert.deepEqual(
    towns.map((row) => row.page.slug),
    ["london", "nairobi"],
  );
  assert.equal(towns.some((row) => row.page.slug === "kisumu"), false);

  const links = hubLinksFromCounts({
    towns: [
      { label: "Nairobi", count: 5, href: "/places/nairobi" },
      { label: "London", count: 5, href: "/places/london" },
      { label: "Kisumu", count: 0, href: "/places/kisumu" },
    ],
    categories: [
      { label: "Catering", count: 2 },
      { label: "Food & restaurants", count: 9 },
    ],
    limit: 1,
  });
  assert.deepEqual(links.towns, [{ href: "/places/london", label: "London" }]);
  assert.deepEqual(links.categories, [{ href: categoryHref("Food & restaurants"), label: "Food & restaurants" }]);
});

test("a large sitemap splits into an index and the pieces keep every url", () => {
  const entries = [0, 1, 2].map((id) => ({
    url: `${origin}/listings/list_${id}`,
    lastModified: new Date(`2026-01-0${id + 1}T00:00:00.000Z`),
  }));
  const chunks = chunkSitemap(entries, 2);
  assert.equal(chunks.length, 2);
  assert.equal(chunks.flat().length, 3);
  const index = renderSitemapIndex(
    chunks.map((chunk, id) => ({ loc: `${origin}/sitemaps/${id}.xml`, lastModified: chunk[0]?.lastModified })),
  );
  assert.match(index, /<sitemapindex/);
  assert.match(index, /sitemaps\/0\.xml/);
  assert.match(index, /sitemaps\/1\.xml/);
  assert.doesNotMatch(index, /<urlset/);
  const first = renderSitemapUrlset(chunks[0] ?? []);
  assert.match(first, /list_0/);
  assert.match(first, /list_1/);
  assert.doesNotMatch(first, /list_2/);
  assert.match(renderSitemapUrlset([{ url: `${origin}/listings?category=Food&town=Kisumu` }]), /&amp;/);
  assert.doesNotMatch(renderSitemapUrlset([{ url: `${origin}/listings?category=Food&town=Kisumu` }]), /&town/);
});

test("listing links render as crawlable anchors", () => {
  const html = renderToStaticMarkup(
    createElement(ListingLinkList, {
      listings: [
        { id: "list_1", title: "Lunch plate", priceLabel: "500" },
        { id: "list_2", title: "No price", priceLabel: "" },
      ],
    }),
  );
  assert.match(html, /href="\/listings\/list_1"/);
  assert.match(html, /href="\/listings\/list_2"/);
  assert.match(html, /Ksh 500/);
  assert.doesNotMatch(html, /No price[\s\S]*Ksh/);
});
