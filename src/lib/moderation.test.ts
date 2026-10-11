import assert from "node:assert/strict";
import test from "node:test";
import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import {
  requiredReason,
  setListingFeaturedState,
  setListingHiddenState,
  setOfferingHiddenState,
  setReviewHiddenState,
  setShopHiddenState,
  setUserProState,
  setUserSuspendedState,
  type AdminActor,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  isPublicListing,
  isPublicOffering,
  isPublicReview,
  isPublicShop,
  listingOpenTo,
  profileOpenTo,
  shopOpenTo,
} from "@/lib/visibility";

test("takedown needs a reason, and a suspended account stays out of public pages", () => {
  assert.equal(requiredReason("  "), null);
  assert.equal(requiredReason("ok"), null);
  assert.equal(requiredReason("  scam shop  "), "scam shop");

  assert.equal(isPublicListing({ hidden: false, ownerSuspended: false }), true);
  assert.equal(isPublicListing({ hidden: true, ownerSuspended: false }), false);
  assert.equal(isPublicListing({ hidden: false, ownerSuspended: true }), false);
  assert.equal(isPublicShop({ published: true, hidden: false, ownerSuspended: false }), true);
  assert.equal(isPublicShop({ published: true, hidden: true, ownerSuspended: false }), false);
  assert.equal(isPublicShop({ published: false, hidden: false, ownerSuspended: false }), false);
  assert.equal(isPublicShop({ published: true, hidden: false, ownerSuspended: true }), false);
  assert.equal(
    isPublicOffering({ archived: false, hidden: false, shopPublished: true, shopHidden: false, ownerSuspended: false }),
    true,
  );
  assert.equal(
    isPublicOffering({ archived: false, hidden: true, shopPublished: true, shopHidden: false, ownerSuspended: false }),
    false,
  );
  assert.equal(
    isPublicReview({ hidden: false, authorSuspended: false, listingHidden: false, ownerSuspended: false }),
    true,
  );
  assert.equal(
    isPublicReview({ hidden: true, authorSuspended: false, listingHidden: false, ownerSuspended: false }),
    false,
  );

  const owner = { id: "owner", role: "user" };
  const admin = { id: "admin", role: "admin" };
  assert.equal(listingOpenTo(null, { hidden: true, ownerId: "owner", ownerSuspended: false }), false);
  assert.equal(listingOpenTo(owner, { hidden: true, ownerId: "owner", ownerSuspended: false }), true);
  assert.equal(listingOpenTo(owner, { hidden: false, ownerId: "owner", ownerSuspended: true }), false);
  assert.equal(listingOpenTo(admin, { hidden: false, ownerId: "owner", ownerSuspended: true }), true);
  assert.equal(shopOpenTo(null, { published: true, hidden: true, ownerId: "owner", ownerSuspended: false }), false);
  assert.equal(shopOpenTo(owner, { published: true, hidden: true, ownerId: "owner", ownerSuspended: false }), true);
  assert.equal(shopOpenTo(owner, { published: true, hidden: false, ownerId: "owner", ownerSuspended: true }), false);
  assert.equal(profileOpenTo(null, { suspended: true }), false);
  assert.equal(profileOpenTo(admin, { suspended: true }), true);
  assert.equal(profileOpenTo(null, { suspended: false }), true);

  const listingWhere = publicListingWhere({ hidden: false }, {});
  assert.match(JSON.stringify(listingWhere), /suspended/);
  const shopWhere = publicShopWhere({ published: true }, {});
  assert.match(JSON.stringify(shopWhere), /hidden/);
});

test("an admin cannot suspend their own account", async () => {
  const self = { id: "same-admin", email: "kevin@rangach.co.ke", name: "Kevin" };
  const result = await setUserSuspendedState(self, "same-admin", true, "Do not lock the door");
  assert.deepEqual(result, { ok: false, code: "self" });
});

test("takedown and restore keep the rows and write an audit log", async () => {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const seller = await prisma.user.create({
    data: {
      email: `mod-seller-${stamp}@example.com`,
      name: "Mod Seller",
      passwordHash: "x",
      city: "Kisumu",
    },
  });
  const moderator = await prisma.user.create({
    data: {
      email: `mod-admin-${stamp}@example.com`,
      name: "Mod Admin",
      passwordHash: "x",
      city: "Kisumu",
      role: "admin",
    },
  });
  const who: AdminActor = { id: moderator.id, email: moderator.email, name: moderator.name };
  const shop = await prisma.storefront.create({
    data: { userId: seller.id, slug: `mod-shop-${stamp}`, published: true },
  });
  const offering = await prisma.offering.create({
    data: { storefrontId: shop.id, title: "Fried tilapia" },
  });
  const listing = await prisma.listing.create({
    data: {
      type: "business",
      title: "Tilapia",
      description: "Fried tilapia from the lake.",
      category: "Food & restaurants",
      city: "Kisumu",
      region: "homeland",
      ownerId: seller.id,
    },
  });
  const review = await prisma.review.create({
    data: { listingId: listing.id, authorId: moderator.id, rating: 5, body: "Fresh fish." },
  });

  try {
    const hiddenListing = await setListingHiddenState(who, listing.id, true, "Fake seller");
    assert.equal(hiddenListing.ok, true);
    const featured = await setListingFeaturedState(who, listing.id, true, "Feature listing");
    assert.equal(featured.ok, true);
    const hiddenShop = await setShopHiddenState(who, shop.id, true, "Scam shop");
    assert.equal(hiddenShop.ok, true);
    const hiddenOffering = await setOfferingHiddenState(who, offering.id, true, "Wrong photo");
    assert.equal(hiddenOffering.ok, true);
    const hiddenReview = await setReviewHiddenState(who, review.id, true, "Fake review");
    assert.equal(hiddenReview.ok, true);
    const suspended = await setUserSuspendedState(who, seller.id, true, "Cannot sign in");
    assert.equal(suspended.ok, true);
    const pro = await setUserProState(who, seller.id, true, "Grant Pro plan");
    assert.equal(pro.ok, true);

    const listingRow = await prisma.listing.findUnique({ where: { id: listing.id } });
    const shopRow = await prisma.storefront.findUnique({ where: { id: shop.id } });
    const offeringRow = await prisma.offering.findUnique({ where: { id: offering.id } });
    const reviewRow = await prisma.review.findUnique({ where: { id: review.id } });
    const sellerRow = await prisma.user.findUnique({ where: { id: seller.id } });
    assert.equal(listingRow?.hidden, true);
    assert.equal(listingRow?.hiddenReason, "Fake seller");
    assert.equal(listingRow?.featured, true);
    assert.ok(listingRow?.featuredUntil);
    assert.equal(shopRow?.hidden, true);
    assert.equal(shopRow?.published, true);
    assert.equal(offeringRow?.hidden, true);
    assert.equal(offeringRow?.archived, false);
    assert.equal(reviewRow?.hidden, true);
    assert.equal(sellerRow?.suspended, true);
    assert.equal(sellerRow?.verifiedPro, true);

    const publicListings = await prisma.listing.count({
      where: { id: listing.id, ...publicListingWhere({ hidden: false }) },
    });
    const publicShops = await prisma.storefront.count({
      where: { id: shop.id, ...publicShopWhere({ published: true }) },
    });
    assert.equal(publicListings, 0);
    assert.equal(publicShops, 0);

    await setListingHiddenState(who, listing.id, false, "Checked and restored");
    await setShopHiddenState(who, shop.id, false, "Shop restored");
    await setOfferingHiddenState(who, offering.id, false, "Offering restored");
    await setReviewHiddenState(who, review.id, false, "Review restored");
    await setUserSuspendedState(who, seller.id, false, "Account restored");
    await setListingFeaturedState(who, listing.id, false, "Remove featured");

    const restored = await prisma.listing.findUnique({ where: { id: listing.id } });
    const openSeller = await prisma.user.findUnique({ where: { id: seller.id } });
    const openShop = await prisma.storefront.findUnique({ where: { id: shop.id } });
    assert.equal(restored?.hidden, false);
    assert.equal(restored?.featured, false);
    assert.equal(openSeller?.suspended, false);
    assert.equal(openShop?.hidden, false);
    assert.equal(openShop?.published, true);

    const visible = await prisma.listing.count({
      where: { id: listing.id, ...publicListingWhere({ hidden: false }) },
    });
    assert.equal(visible, 1);

    const logs = await prisma.adminAuditLog.findMany({
      where: { actorId: moderator.id },
      orderBy: { createdAt: "asc" },
    });
    const actions = logs.map((row) => row.action);
    assert.ok(actions.includes("listing.hide"));
    assert.ok(actions.includes("listing.restore"));
    assert.ok(actions.includes("listing.feature"));
    assert.ok(actions.includes("listing.unfeature"));
    assert.ok(actions.includes("shop.hide"));
    assert.ok(actions.includes("shop.restore"));
    assert.ok(actions.includes("offering.hide"));
    assert.ok(actions.includes("offering.restore"));
    assert.ok(actions.includes("review.hide"));
    assert.ok(actions.includes("review.restore"));
    assert.ok(actions.includes("user.suspend"));
    assert.ok(actions.includes("user.unsuspend"));
    assert.ok(actions.includes("pro.grant"));
    assert.equal(logs.every((row) => row.reason.length > 0), true);
    assert.equal(await prisma.user.count({ where: { id: seller.id } }), 1);
    assert.equal(await prisma.listing.count({ where: { id: listing.id } }), 1);
  } finally {
    await prisma.adminAuditLog.deleteMany({ where: { actorId: moderator.id } });
    await prisma.user.delete({ where: { id: seller.id } });
    await prisma.user.delete({ where: { id: moderator.id } });
  }
});
