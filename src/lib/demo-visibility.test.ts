import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeRail } from "@/components/home-rail";
import { DEMO_EMAIL_DOMAIN } from "@/lib/admin-access";
import {
  hiddenDemoUserFilter,
  isPublicDemoHidden,
  publicListingWhere,
  publicShopWhere,
  shouldLoadDemoSeed,
  showDemoShops,
} from "@/lib/demo-visibility";

test("demo shops are hidden when SHOW_DEMO_SHOPS is off and included when it is on", () => {
  assert.equal(showDemoShops({}), false);
  assert.equal(showDemoShops({ SHOW_DEMO_SHOPS: "" }), false);
  assert.equal(showDemoShops({ SHOW_DEMO_SHOPS: "0" }), false);
  assert.equal(showDemoShops({ SHOW_DEMO_SHOPS: "1" }), true);
  assert.equal(showDemoShops({ SHOW_DEMO_SHOPS: "true" }), true);
  assert.equal(showDemoShops({ SHOW_DEMO_SHOPS: " YES " }), true);
  assert.equal(showDemoShops({ SHOW_DEMO_SHOPS: "on" }), true);

  assert.equal(isPublicDemoHidden("atieno@dala.local", {}), true);
  assert.equal(isPublicDemoHidden("Atieno@Dala.Local", {}), true);
  assert.equal(isPublicDemoHidden("seller@rangach.co.ke", {}), false);
  assert.equal(isPublicDemoHidden("atieno@dala.local", { SHOW_DEMO_SHOPS: "1" }), false);

  const hiddenListings = publicListingWhere({ hidden: false }, {});
  assert.deepEqual(hiddenListings, {
    AND: [{ hidden: false }, { owner: { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } } }],
  });
  assert.deepEqual(publicListingWhere({ hidden: false }, { SHOW_DEMO_SHOPS: "on" }), { hidden: false });
  assert.equal(hiddenDemoUserFilter({ SHOW_DEMO_SHOPS: "1" }), null);

  assert.deepEqual(publicShopWhere({ published: true }, {}), {
    AND: [{ published: true }, { user: { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } } }],
  });
  assert.deepEqual(publicShopWhere({ published: true }, { SHOW_DEMO_SHOPS: "1" }), { published: true });
});

test("the seed is only demo accounts, and a later deploy does not re-create or unhide them", () => {
  const seed = readFileSync(new URL("../../prisma/seed.ts", import.meta.url), "utf8");
  const users = seed.split("const users")[1]?.split("type SeedListing")[0] ?? "";
  const listings = seed.split("const listings")[1]?.split("const photo")[0] ?? "";
  const shops = seed.split("const shops")[1]?.split("async function main")[0] ?? "";
  const emails = [...users.matchAll(/email: "([^"]+)"/g)].map((match) => match[1]);
  const listingOwners = [...listings.matchAll(/owner: "([^"]+)"/g)].map((match) => match[1]);
  const shopOwners = [...shops.matchAll(/owner: "([^"]+)"/g)].map((match) => match[1]);
  const slugs = [...shops.matchAll(/slug: "([^"]+)"/g)].map((match) => match[1]);

  assert.equal(emails.length, 8);
  assert.equal(slugs.length, 3);
  assert.equal(listingOwners.length, 37);
  assert.equal((listings.match(/hidden: true/g) ?? []).length, 1);
  for (const email of [...emails, ...listingOwners, ...shopOwners]) {
    assert.equal(email.endsWith("@dala.local"), true, email);
  }
  assert.equal(seed.includes("seedShouldSkip"), true);

  assert.equal(shouldLoadDemoSeed(0), true);
  assert.equal(shouldLoadDemoSeed(1), false);
  const script = readFileSync(new URL("../../scripts/seed-if-empty.mjs", import.meta.url), "utf8");
  assert.match(script, /users > 0/);
  assert.match(script, /Skipping seed/);
  assert.equal(script.includes("hidden:"), false);
  assert.equal(script.includes("published:"), false);
});

test("the home page has an empty state when featured listings and classifieds are absent", () => {
  const props = {
    title: "Featured",
    hint: "Raised shops and listings worth a look first.",
    browseHref: "/listings",
    browseLabel: "Browse all",
    emptyTitle: "No featured listings yet",
    emptyBody: "Listing a business is free.",
    action: null,
  };
  const empty = renderToStaticMarkup(createElement(HomeRail, { ...props, empty: true }, "hidden card"));
  assert.match(empty, /No featured listings yet/);
  assert.equal(empty.includes("hidden card"), false);

  const filled = renderToStaticMarkup(createElement(HomeRail, { ...props, empty: false }, "visible card"));
  assert.match(filled, /visible card/);
  assert.equal(filled.includes("No featured listings yet"), false);
});

test("public surfaces that can leak demo rows apply the visibility filter", () => {
  const files = [
    "../lib/search.ts",
    "../app/sitemap.ts",
    "../app/categories/page.tsx",
    "../app/occasions/page.tsx",
    "../app/occasions/[slug]/page.tsx",
    "../lib/og-load.ts",
    "../app/b/[slug]/page.tsx",
    "../app/listings/[id]/page.tsx",
    "../app/people/[id]/page.tsx",
    "../lib/ai/seller-tips.ts",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /demo-visibility/, file);
  }
  const listings = readFileSync(new URL("../app/listings/page.tsx", import.meta.url), "utf8");
  assert.match(listings, /searchListings/);
});
