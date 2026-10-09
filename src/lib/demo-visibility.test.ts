import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeRail } from "@/components/home-rail";
import { SellerContactChannels } from "@/components/seller-contact";
import { DEMO_EMAIL_DOMAIN } from "@/lib/admin-access";
import {
  DEMO_SHOP_CONTACT_NOTE,
  hiddenDemoUserFilter,
  hideDemoShops,
  isPublicDemoHidden,
  publicListingWhere,
  publicSellerContacts,
  publicShopWhere,
  publicTextWithoutDemoNumbers,
  shouldLoadDemoSeed,
} from "@/lib/demo-visibility";

test("demo shops stay visible unless HIDE_DEMO_SHOPS is on", () => {
  assert.equal(hideDemoShops({}), false);
  assert.equal(hideDemoShops({ HIDE_DEMO_SHOPS: "" }), false);
  assert.equal(hideDemoShops({ HIDE_DEMO_SHOPS: "0" }), false);
  assert.equal(hideDemoShops({ SHOW_DEMO_SHOPS: "1" }), false);
  assert.equal(hideDemoShops({ HIDE_DEMO_SHOPS: "1" }), true);
  assert.equal(hideDemoShops({ HIDE_DEMO_SHOPS: "true" }), true);
  assert.equal(hideDemoShops({ HIDE_DEMO_SHOPS: " YES " }), true);
  assert.equal(hideDemoShops({ HIDE_DEMO_SHOPS: "on" }), true);

  assert.equal(isPublicDemoHidden("atieno@dala.local", {}), false);
  assert.equal(isPublicDemoHidden("Atieno@Dala.Local", {}), false);
  assert.equal(isPublicDemoHidden("seller@rangach.co.ke", {}), false);
  assert.equal(isPublicDemoHidden("atieno@dala.local", { HIDE_DEMO_SHOPS: "1" }), true);
  assert.equal(isPublicDemoHidden("Atieno@Dala.Local", { HIDE_DEMO_SHOPS: "on" }), true);
  assert.equal(isPublicDemoHidden("seller@rangach.co.ke", { HIDE_DEMO_SHOPS: "1" }), false);

  assert.deepEqual(publicListingWhere({ hidden: false }, {}), { hidden: false });
  assert.equal(hiddenDemoUserFilter({}), null);
  assert.deepEqual(publicShopWhere({ published: true }, {}), { published: true });

  const hiddenListings = publicListingWhere({ hidden: false }, { HIDE_DEMO_SHOPS: "1" });
  assert.deepEqual(hiddenListings, {
    AND: [{ hidden: false }, { owner: { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } } }],
  });
  assert.deepEqual(publicShopWhere({ published: true }, { HIDE_DEMO_SHOPS: "yes" }), {
    AND: [{ published: true }, { user: { email: { not: { endsWith: DEMO_EMAIL_DOMAIN } } } }],
  });
});

test("a demo shop never shows its placeholder phone or WhatsApp", () => {
  const placeholder = { email: "atieno@dala.local", phone: "+254711000101", whatsapp: "+254711000101" };
  assert.equal(isPublicDemoHidden(placeholder.email, {}), false);
  assert.equal(isPublicDemoHidden(placeholder.email, { HIDE_DEMO_SHOPS: "0" }), false);
  assert.equal(isPublicDemoHidden(placeholder.email, { HIDE_DEMO_SHOPS: "1" }), true);
  assert.deepEqual(publicSellerContacts(placeholder), { hidden: true, phone: "", whatsapp: "" });

  const real = publicSellerContacts({
    email: "seller@rangach.co.ke",
    phone: "+254729217350",
    whatsapp: "+254729217350",
  });
  assert.deepEqual(real, { hidden: false, phone: "+254729217350", whatsapp: "+254729217350" });

  const stripped = publicTextWithoutDemoNumbers(
    "atieno@dala.local",
    "Call +254711000101 or WhatsApp 254711000101.",
    ["+254711000101"],
  );
  assert.equal(stripped.includes("254711000101"), false);
  assert.equal(
    publicTextWithoutDemoNumbers("seller@rangach.co.ke", "Call +254729217350.", ["+254729217350"]),
    "Call +254729217350.",
  );

  const hidden = renderToStaticMarkup(
    createElement(SellerContactChannels, {
      hidden: true,
      note: DEMO_SHOP_CONTACT_NOTE,
      intro: "Ask on WhatsApp. Payment for goods stays between you and the seller.",
      phone: "+254711000101",
      whatsapp: "+254711000101",
      email: "atieno@dala.local",
      chatUrl: "https://wa.me/254711000101",
      callUrl: "tel:+254711000101",
      family: {
        phone: "+254711000101",
        subjectName: "Mama Atieno",
        path: "/b/mama-atieno",
        siteName: "Rangach",
      },
    }),
  );
  assert.match(hidden, /Contact details not available for this shop/);
  assert.equal(hidden.includes("254711000101"), false);
  assert.equal(hidden.includes("wa.me"), false);
  assert.equal(hidden.includes("tel:"), false);
  assert.equal(hidden.includes("WhatsApp"), false);
  assert.equal(hidden.includes("atieno@dala.local"), false);

  const shown = renderToStaticMarkup(
    createElement(SellerContactChannels, {
      hidden: false,
      note: DEMO_SHOP_CONTACT_NOTE,
      phone: "+254729217350",
      whatsapp: "+254729217350",
      chatUrl: "https://wa.me/254729217350",
      callUrl: "tel:+254729217350",
    }),
  );
  assert.match(shown, /Phone \+254729217350/);
  assert.match(shown, /https:\/\/wa\.me\/254729217350/);
  assert.match(shown, /tel:\+254729217350/);
  assert.equal(shown.includes(DEMO_SHOP_CONTACT_NOTE), false);

  for (const file of ["../app/b/[slug]/page.tsx", "../app/listings/[id]/page.tsx", "../app/people/[id]/page.tsx", "../lib/search.ts", "../components/listing-card.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /publicSellerContacts|SellerContactChannels|DemoContactNote/, file);
  }
  const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.equal(example.includes("SHOW_DEMO_SHOPS"), false);
  assert.match(example, /HIDE_DEMO_SHOPS/);
  assert.equal(readme.includes("SHOW_DEMO_SHOPS"), false);
  assert.match(readme, /HIDE_DEMO_SHOPS/);
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
