import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { guideCurrentStep, type GuideProgress } from "@/lib/launch-pages";
import { publishShopButtonVisible } from "@/lib/shop-publish";
import { parseOfferingForm } from "@/lib/validators";

/**
 * Same reads as /list and /account/storefront: active offerings, not directory listings.
 * Publish shop is the storefront.published flip. The page shows the button once one offering is not archived.
 */
async function sellerState(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { whatsapp: true, phone: true },
  });
  const shop = await prisma.storefront.findUnique({
    where: { userId },
    select: {
      id: true,
      published: true,
      _count: { select: { offerings: { where: { archived: false } } } },
    },
  });
  const activeOfferings = shop?._count.offerings ?? 0;
  const progress: GuideProgress = {
    signedIn: true,
    hasShop: Boolean(shop),
    hasOffering: activeOfferings > 0,
    shopPublished: Boolean(shop?.published),
    hasWhatsapp: Boolean(user.whatsapp.trim() || user.phone.trim()),
  };
  const button = shop
    ? publishShopButtonVisible({ published: shop.published, activeOfferings })
    : false;
  return { shop, progress, button, step: guideCurrentStep(progress) };
}

test("a new seller who follows the list steps can publish the shop", async () => {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      email: `seller-publish-${stamp}@example.com`,
      name: "Brochure Seller",
      passwordHash: "x",
      city: "Kisumu",
    },
  });

  try {
    const accountOnly = await sellerState(user.id);
    assert.equal(accountOnly.step, "shop");
    assert.equal(accountOnly.button, false);

    await prisma.listing.create({
      data: {
        type: "classified",
        title: "One chair",
        description: "A classified, not a shop offering.",
        category: "Furniture",
        city: "Kisumu",
        region: "homeland",
        ownerId: user.id,
      },
    });
    const afterClassified = await sellerState(user.id);
    assert.equal(afterClassified.step, "shop");
    assert.equal(afterClassified.progress.hasOffering, false);
    assert.equal(afterClassified.button, false);

    const shop = await prisma.storefront.create({
      data: { userId: user.id, slug: `brochure-shop-${stamp}`, published: false },
    });
    const draftShop = await sellerState(user.id);
    assert.equal(draftShop.step, "offering");
    assert.equal(draftShop.button, false);

    await prisma.offering.create({
      data: {
        storefrontId: shop.id,
        title: "Old menu",
        description: "Archived, so it must not unlock Publish shop.",
        archived: true,
      },
    });
    const archivedOnly = await sellerState(user.id);
    assert.equal(archivedOnly.step, "offering");
    assert.equal(archivedOnly.button, false);

    const form = new FormData();
    form.set("title", "Fish fry");
    form.set("description", "Friday fish from the shop.");
    form.set("price", "");
    form.set("currency", "KES");
    form.set("imageUrl", "");
    const parsed = parseOfferingForm(form);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    await prisma.offering.create({
      data: {
        storefrontId: shop.id,
        title: parsed.data.title,
        description: parsed.data.description,
        priceCents: parsed.data.priceCents,
        currency: parsed.data.currency,
        imageUrl: parsed.data.imageUrl,
        sortOrder: 1,
      },
    });
    const withOffering = await sellerState(user.id);
    assert.equal(withOffering.progress.hasOffering, true);
    assert.equal(withOffering.button, true);
    assert.equal(withOffering.step, "whatsapp");

    await prisma.user.update({ where: { id: user.id }, data: { phone: "+254700000001" } });
    const withPhone = await sellerState(user.id);
    assert.equal(withPhone.progress.hasWhatsapp, true);
    assert.equal(withPhone.step, "live");
    assert.equal(withPhone.button, true);

    await prisma.user.update({ where: { id: user.id }, data: { phone: "", whatsapp: "+254700000002" } });
    const ready = await sellerState(user.id);
    assert.equal(ready.step, "live");
    assert.equal(ready.button, true);

    if (!ready.shop?.published) {
      await prisma.storefront.update({ where: { id: shop.id }, data: { published: true } });
    }
    const live = await sellerState(user.id);
    assert.equal(live.shop?.published, true);
    assert.equal(live.button, false);
    assert.equal(live.step, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
