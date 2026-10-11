import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer } from "@/components/footer";
import { ShopsDirectory } from "@/components/shops-directory";
import { parseNlQuery, categoryFromKeys } from "@/lib/nl-query";
import { prisma } from "@/lib/prisma";
import { homeRails, searchCatalogue, searchShops, shopCategoryCounts } from "@/lib/search";
import { containsFilter, searchTerms } from "@/lib/search-text";
import { categoryCountLabel } from "@/lib/shop-category";
import { staticPublicPaths } from "@/lib/sitemap-entries";

test("postgres search is case-insensitive and plurals fold", () => {
  assert.equal(containsFilter("Catering", { DATABASE_URL: "postgresql://localhost/rangach" }).mode, "insensitive");
  assert.equal("mode" in containsFilter("Catering", { DATABASE_URL: "file:./dev.db" }), false);
  assert.ok(searchTerms("CATERING").includes("catering"));
  assert.ok(searchTerms("shops").includes("shop"));
  assert.ok(searchTerms("catering").includes("caterings"));
  assert.deepEqual(searchTerms("fried tilapia"), ["fried tilapia"]);
});

test("shop categories use the listing keyword map and the place parser stays put", () => {
  assert.equal(categoryFromKeys("weekend catering bookings"), "Food & restaurants");
  assert.equal(categoryFromKeys("catering"), parseNlQuery("catering").category);
  const placed = parseNlQuery("catering in Kisumu");
  assert.equal(placed.category, "Food & restaurants");
  assert.equal(placed.region, "homeland");
  assert.equal(placed.city, "");
  assert.equal(placed.q, "");
  assert.equal(categoryCountLabel(2, 1), "2 listings, 1 shop");
  assert.equal(categoryCountLabel(0, 1), "1 shop");
  assert.equal(categoryCountLabel(0, 0), "0 listings");
});

test("catering in any case matches a shop and its offering, and drafts, archived, hidden, and demo rows stay out", async () => {
  const stamp = Date.now().toString(36);
  const token = `catering${stamp}`;
  const owner = await prisma.user.create({
    data: {
      email: `caterer-${stamp}@example.com`,
      name: `Catering Co ${stamp}`,
      passwordHash: "x",
      city: "Nairobi",
      bio: `Weekend ${token} for gatherings.`,
    },
  });
  const draftOwner = await prisma.user.create({
    data: {
      email: `draft-caterer-${stamp}@example.com`,
      name: `Draft catering ${stamp}`,
      passwordHash: "x",
      city: "Nairobi",
      bio: token,
    },
  });
  const demoOwner = await prisma.user.create({
    data: {
      email: `demo-caterer-${stamp}@dala.local`,
      name: `Demo catering ${stamp}`,
      passwordHash: "x",
      city: "Nairobi",
      bio: token,
    },
  });
  try {
    const shop = await prisma.storefront.create({
      data: {
        userId: owner.id,
        slug: `catering-${stamp}`,
        published: true,
        phoneVerified: true,
        offerings: {
          create: [
            {
              title: `Catering tray ${stamp}`,
              description: token,
              sortOrder: 0,
            },
            {
              title: `Archived ${token}`,
              description: "This tray was taken off the menu.",
              archived: true,
              sortOrder: 1,
            },
          ],
        },
      },
      include: { offerings: true },
    });
    const liveOffering = shop.offerings.find((offering) => offering.title.startsWith("Catering tray"));
    const archived = shop.offerings.find((offering) => offering.archived);
    assert.ok(liveOffering);
    assert.ok(archived);

    await prisma.storefront.create({
      data: { userId: draftOwner.id, slug: `draft-catering-${stamp}`, published: false },
    });
    await prisma.storefront.create({
      data: { userId: demoOwner.id, slug: `demo-catering-${stamp}`, published: true, phoneVerified: true },
    });
    const hidden = await prisma.listing.create({
      data: {
        type: "business",
        title: `Hidden catering ${stamp}`,
        description: token,
        category: "Food & restaurants",
        city: "Nairobi",
        region: "homeland",
        hidden: true,
        ownerId: owner.id,
      },
    });

    for (const q of ["catering", "Catering", "CATERING"]) {
      const result = await searchCatalogue({ q, pageSize: 50 });
      const kinds = result.hits.filter((hit): boolean => {
        if (hit.kind === "shop") return hit.shop.id === shop.id;
        if (hit.kind === "offering") return hit.offering.id === liveOffering.id;
        return false;
      });
      assert.equal(kinds.length, 2, q);
    }

    const lower = await searchCatalogue({ q: token, pageSize: 50 });
    const ids = lower.hits.map((hit) => (hit.kind === "listing" ? hit.listing.id : hit.kind === "shop" ? hit.shop.id : hit.offering.id));
    assert.ok(ids.includes(shop.id));
    assert.ok(ids.includes(liveOffering.id));
    assert.equal(ids.includes(archived.id), false);
    assert.equal(ids.includes(hidden.id), false);
    assert.equal(
      lower.hits.some((hit) => hit.kind === "shop" && hit.shop.slug === `draft-catering-${stamp}`),
      false,
    );

    const hiddenDemo = await searchCatalogue({ q: token, pageSize: 50 }, { ...process.env, HIDE_DEMO_SHOPS: "1" });
    assert.equal(
      hiddenDemo.hits.some((hit) => hit.kind === "shop" && hit.shop.slug === `demo-catering-${stamp}`),
      false,
    );
    assert.ok(hiddenDemo.hits.some((hit) => hit.kind === "shop" && hit.shop.id === shop.id));

    const classifieds = await searchCatalogue({ q: token, type: "classifieds", pageSize: 50 });
    assert.equal(
      classifieds.hits.some((hit) => hit.kind === "shop" || hit.kind === "offering"),
      false,
    );

    const abroad = await searchCatalogue({ q: token, region: "diaspora", pageSize: 50 });
    assert.equal(
      abroad.hits.some((hit) => hit.kind === "shop" && hit.shop.id === shop.id),
      false,
    );

    const shops = await searchShops({ q: "CATERING", pageSize: 50 });
    const card = shops.shops.find((item) => item.id === shop.id);
    assert.ok(card);
    assert.equal(card.region, "homeland");
    assert.equal(card.phoneVerified, true);
    const html = renderToStaticMarkup(
      createElement(ShopsDirectory, {
        shops: [card],
        query: "catering",
        category: "",
        region: "",
        city: "",
        verified: false,
        page: 1,
        pageCount: 1,
        total: 1,
      }),
    );
    assert.match(html, new RegExp(`Catering Co ${stamp}`));
    assert.ok(html.includes(`href="/b/catering-${stamp}"`));
    assert.match(html, /Homeland/);
    assert.match(html, /Phone verified/);
    assert.match(html, /Showing shops for “catering”/);
    assert.ok(html.includes('action="/shops"'));

    const verifiedShops = await searchShops({ q: token, verified: true, pageSize: 20 });
    assert.ok(verifiedShops.shops.some((item) => item.id === shop.id));
    const strict = await searchCatalogue({ q: token, verified: true, pageSize: 20 });
    assert.equal(
      strict.hits.some((hit) => hit.kind === "shop" && hit.shop.id === shop.id),
      false,
    );
  } finally {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, draftOwner.id, demoOwner.id] } },
    });
  }
});

test("category counts include a published shop and skip a draft", async () => {
  const stamp = Date.now().toString(36);
  const owner = await prisma.user.create({
    data: { email: `pharmacy-${stamp}@example.com`, name: `Pharmacy ${stamp}`, passwordHash: "x", city: "Nairobi" },
  });
  const draftOwner = await prisma.user.create({
    data: { email: `pharmacy-draft-${stamp}@example.com`, name: `Draft pharmacy ${stamp}`, passwordHash: "x" },
  });
  try {
    const before = await shopCategoryCounts();
    await prisma.storefront.create({
      data: { userId: owner.id, slug: `pharmacy-${stamp}`, published: true },
    });
    await prisma.listing.create({
      data: {
        type: "business",
        title: `Counter ${stamp}`,
        description: "Medicines.",
        category: "Pharmacies",
        city: "Nairobi",
        region: "homeland",
        ownerId: owner.id,
      },
    });
    await prisma.storefront.create({
      data: { userId: draftOwner.id, slug: `pharmacy-draft-${stamp}`, published: false },
    });
    await prisma.listing.create({
      data: {
        type: "business",
        title: `Draft counter ${stamp}`,
        description: "Not public.",
        category: "Pharmacies",
        city: "Nairobi",
        region: "homeland",
        ownerId: draftOwner.id,
      },
    });
    const after = await shopCategoryCounts();
    assert.equal((after.get("Pharmacies") ?? 0), (before.get("Pharmacies") ?? 0) + 1);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, draftOwner.id] } } });
  }
});

test("a taken-down shop, a hidden offering, and a suspended owner stay out until they are restored", async () => {
  const stamp = Date.now().toString(36);
  const email = `takedown-${stamp}@example.com`;
  const token = `takedown${stamp}`;
  const secret = `braidingsecret${stamp}`;
  const owner = await prisma.user.create({
    data: {
      email,
      name: `Takedown Stall ${stamp}`,
      passwordHash: "x",
      city: "Nairobi",
      bio: token,
    },
  });
  const before = await shopCategoryCounts();
  try {
    const shop = await prisma.storefront.create({
      data: {
        userId: owner.id,
        slug: `takedown-${stamp}`,
        published: true,
        offerings: {
          create: [
            { title: `Open plate ${stamp}`, description: token, sortOrder: 0 },
            { title: `Braiding ${secret}`, description: secret, hidden: true, sortOrder: 1 },
          ],
        },
      },
      include: { offerings: true },
    });
    const visible = shop.offerings.find((offering) => !offering.hidden);
    const hiddenOffering = shop.offerings.find((offering) => offering.hidden);
    assert.ok(visible);
    assert.ok(hiddenOffering);
    const listing = await prisma.listing.create({
      data: {
        type: "business",
        title: `Counsel ${stamp}`,
        description: token,
        category: "Legal & immigration",
        city: "Nairobi",
        region: "homeland",
        featured: true,
        ownerId: owner.id,
      },
    });

    const idsOf = (hits: Awaited<ReturnType<typeof searchCatalogue>>["hits"]) =>
      hits.map((hit) => (hit.kind === "listing" ? hit.listing.id : hit.kind === "shop" ? hit.shop.id : hit.offering.id));

    const live = await searchCatalogue({ q: token, pageSize: 50 });
    const liveIds = idsOf(live.hits);
    assert.ok(liveIds.includes(shop.id));
    assert.ok(liveIds.includes(visible.id));
    assert.ok(liveIds.includes(listing.id));
    assert.equal(JSON.stringify(live).includes(email), false);
    const liveShops = await searchShops({ q: token, pageSize: 20 });
    assert.ok(liveShops.shops.some((item) => item.id === shop.id));
    assert.equal(JSON.stringify(liveShops).includes(email), false);
    const secretHits = await searchCatalogue({ q: secret, pageSize: 20 });
    assert.equal(idsOf(secretHits.hits).includes(hiddenOffering.id), false);
    assert.equal(idsOf(secretHits.hits).includes(shop.id), false);
    const counted = await shopCategoryCounts();
    assert.equal((counted.get("Legal & immigration") ?? 0), (before.get("Legal & immigration") ?? 0) + 1);
    assert.equal(counted.get("Beauty & personal care") ?? 0, before.get("Beauty & personal care") ?? 0);

    await prisma.storefront.update({ where: { id: shop.id }, data: { hidden: true } });
    const takenDown = await searchCatalogue({ q: token, pageSize: 50 });
    const takenIds = idsOf(takenDown.hits);
    assert.equal(takenIds.includes(shop.id), false);
    assert.equal(takenIds.includes(visible.id), false);
    assert.ok(takenIds.includes(listing.id));
    assert.equal((await searchShops({ q: token, pageSize: 20 })).shops.some((item) => item.id === shop.id), false);
    assert.equal((await shopCategoryCounts()).get("Legal & immigration") ?? 0, before.get("Legal & immigration") ?? 0);
    assert.equal((await homeRails()).shops.some((item) => item.id === shop.id), false);

    await prisma.storefront.update({ where: { id: shop.id }, data: { hidden: false } });
    const restoredShop = idsOf((await searchCatalogue({ q: token, pageSize: 50 })).hits);
    assert.ok(restoredShop.includes(shop.id));
    assert.ok(restoredShop.includes(visible.id));
    assert.ok((await searchShops({ q: token, pageSize: 20 })).shops.some((item) => item.id === shop.id));
    assert.equal((await shopCategoryCounts()).get("Legal & immigration") ?? 0, (before.get("Legal & immigration") ?? 0) + 1);

    await prisma.offering.update({ where: { id: visible.id }, data: { hidden: true } });
    const offeringHidden = idsOf((await searchCatalogue({ q: token, pageSize: 50 })).hits);
    assert.equal(offeringHidden.includes(visible.id), false);
    assert.ok(offeringHidden.includes(shop.id));
    assert.equal((await homeRails()).offerings.some((item) => item.id === visible.id), false);

    await prisma.offering.update({ where: { id: visible.id }, data: { hidden: false } });
    assert.ok(idsOf((await searchCatalogue({ q: token, pageSize: 50 })).hits).includes(visible.id));

    await prisma.user.update({ where: { id: owner.id }, data: { suspended: true } });
    const suspended = idsOf((await searchCatalogue({ q: token, pageSize: 50 })).hits);
    assert.equal(suspended.includes(shop.id), false);
    assert.equal(suspended.includes(visible.id), false);
    assert.equal(suspended.includes(listing.id), false);
    assert.equal((await searchShops({ q: token, pageSize: 20 })).shops.some((item) => item.id === shop.id), false);
    assert.equal((await shopCategoryCounts()).get("Legal & immigration") ?? 0, before.get("Legal & immigration") ?? 0);
    const hiddenRails = await homeRails();
    assert.equal(hiddenRails.shops.some((item) => item.id === shop.id), false);
    assert.equal(hiddenRails.offerings.some((item) => item.id === visible.id), false);
    assert.equal(hiddenRails.featured.some((item) => item.id === listing.id), false);

    await prisma.user.update({ where: { id: owner.id }, data: { suspended: false } });
    const back = idsOf((await searchCatalogue({ q: token, pageSize: 50 })).hits);
    assert.ok(back.includes(shop.id));
    assert.ok(back.includes(visible.id));
    assert.ok(back.includes(listing.id));
    assert.ok((await searchShops({ q: token, pageSize: 20 })).shops.some((item) => item.id === shop.id));
    assert.equal((await shopCategoryCounts()).get("Legal & immigration") ?? 0, (before.get("Legal & immigration") ?? 0) + 1);
  } finally {
    await prisma.user.deleteMany({ where: { id: owner.id } });
  }
});

test("the shops directory is linked and listed in the sitemap", () => {
  const footer = renderToStaticMarkup(createElement(Footer));
  assert.ok(footer.includes('href="/shops"'));
  assert.ok(staticPublicPaths().some((item) => item.path === "/shops"));
  const header = readFileSync(new URL("../components/header.tsx", import.meta.url), "utf8");
  assert.ok(header.includes('href="/shops"'));
  const page = readFileSync(new URL("../app/shops/page.tsx", import.meta.url), "utf8");
  assert.match(page, /ShopsDirectory/);
});
