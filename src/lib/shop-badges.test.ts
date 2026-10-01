import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { fulfillPaidPayment } from "@/lib/payments/fulfill";
import { commitShopBadgeChange } from "@/lib/shop-badge-commit";
import {
  formatShopBadgeDate,
  grantedShopBadges,
  latestShopBadgeGrant,
  planShopBadgeChange,
  shopBadgeCheckedLine,
  shopBadgeWhere,
  type ShopBadgeAdmin,
  type ShopBadgeFlags,
} from "@/lib/shop-badges";

const admin: ShopBadgeAdmin = {
  id: "admin_1",
  email: "admin@rangach.co.ke",
  name: "Kevin",
};

const closed: ShopBadgeFlags = {
  phoneVerified: false,
  locationVerified: false,
  businessVerified: false,
};

const when = new Date("2026-10-01T12:00:00.000Z");

function plan(overrides: Partial<Parameters<typeof planShopBadgeChange>[0]> = {}) {
  return planShopBadgeChange({
    role: "admin",
    state: closed,
    badge: "phone",
    action: "grant",
    method: "call",
    note: " Called the shop. ",
    admin,
    storefrontId: "shop_1",
    now: when,
    ...overrides,
  });
}

test("only an admin can grant or remove a shop badge", () => {
  for (const role of ["user", "Admin", "", "moderator"]) {
    const result = plan({ role });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "forbidden");
  }
});

test("a non-admin cannot grant a badge by naming an admin in the payload", () => {
  const result = plan({
    role: "user",
    admin: { id: "admin_1", email: "admin@rangach.co.ke", name: "Kevin" },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "forbidden");
});

test("grant records the admin, the time, and the trimmed note, and leaves the other badges alone", () => {
  const result = plan({ state: { ...closed, locationVerified: true } });
  assert.equal(result.ok, true);
  if (!result.ok || result.unchanged) assert.fail("expected a phone grant");
  assert.deepEqual(result.data, { phoneVerified: true });
  assert.deepEqual(result.event, {
    storefrontId: "shop_1",
    badge: "phone",
    action: "grant",
    method: "call",
    note: "Called the shop.",
    adminId: "admin_1",
    adminEmail: "admin@rangach.co.ke",
    adminName: "Kevin",
    createdAt: when,
  });
});

test("removal records a separate audit event and does not rewrite the other flags", () => {
  const result = plan({
    state: { phoneVerified: true, locationVerified: true, businessVerified: false },
    action: "remove",
    badge: "location",
    note: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.unchanged) assert.fail("expected a location removal");
  assert.deepEqual(result.data, { locationVerified: false });
  assert.equal(result.event.action, "remove");
  assert.equal(result.event.badge, "location");
  assert.equal(result.event.method, "");
  assert.equal(result.event.note, "");
  assert.equal(result.event.adminId, admin.id);
  assert.equal(result.event.createdAt, when);
});

test("repeating a grant or removal does not plan another audit row", () => {
  const again = plan({ state: { ...closed, phoneVerified: true } });
  assert.deepEqual(again, { ok: true, unchanged: true });
  const alreadyOff = plan({ action: "remove" });
  assert.deepEqual(alreadyOff, { ok: true, unchanged: true });
});

test("invalid badge, action, note, or target is rejected for an admin", () => {
  assert.equal(plan({ badge: "identity" }).ok, false);
  assert.equal(plan({ action: "toggle" }).ok, false);
  assert.equal(plan({ storefrontId: " " }).ok, false);
  assert.equal(plan({ admin: { ...admin, id: " " } }).ok, false);
  assert.equal(plan({ note: "x".repeat(281) }).ok, false);
  const tooLong = plan({ note: "x".repeat(281) });
  if (!tooLong.ok) assert.equal(tooLong.code, "invalid");
});

test("a grant must name a method from the fixed list", () => {
  for (const method of [undefined, "", "email", "upload"]) {
    const result = plan({ method });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid");
  }
  for (const method of ["call", "video", "visit", "documents"]) {
    const result = plan({ method });
    assert.equal(result.ok, true);
    if (!result.ok || result.unchanged) assert.fail(`expected a grant by ${method}`);
    assert.equal(result.event.method, method);
  }
});

test("documents seen is a label only and the check line uses the grant date", () => {
  const on = new Date("2026-09-12T12:00:00.000Z");
  assert.equal(formatShopBadgeDate(on), "12 Sep 2026");
  assert.equal(
    shopBadgeCheckedLine({ badge: "phone", createdAt: on, method: "call" }),
    "Phone checked 12 Sep 2026 by call",
  );
  assert.equal(shopBadgeCheckedLine({ badge: "location", method: "video" }), "Location checked by video");
  assert.equal(
    shopBadgeCheckedLine({ badge: "business", createdAt: on, method: "documents" }),
    "Business checked 12 Sep 2026 by documents seen",
  );
  const latest = latestShopBadgeGrant(
    [
      { badge: "phone", action: "grant", method: "call", createdAt: new Date("2026-09-01T00:00:00.000Z") },
      { badge: "phone", action: "remove", method: "", createdAt: new Date("2026-09-10T00:00:00.000Z") },
      { badge: "phone", action: "grant", method: "video", createdAt: new Date("2026-09-12T00:00:00.000Z") },
      { badge: "location", action: "grant", method: "visit", createdAt: new Date("2026-09-18T00:00:00.000Z") },
    ],
    "phone",
  );
  assert.equal(latest?.method, "video");
  assert.equal(latest?.createdAt.toISOString(), "2026-09-12T00:00:00.000Z");
});

test("shop badge search matches one check or any check", () => {
  assert.equal(shopBadgeWhere(""), null);
  assert.equal(shopBadgeWhere("verified"), null);
  assert.deepEqual(shopBadgeWhere("phone"), { owner: { storefront: { phoneVerified: true } } });
  assert.deepEqual(shopBadgeWhere("location"), { owner: { storefront: { locationVerified: true } } });
  assert.deepEqual(shopBadgeWhere("business"), { owner: { storefront: { businessVerified: true } } });
  assert.deepEqual(shopBadgeWhere("any"), {
    owner: {
      storefront: {
        OR: [{ phoneVerified: true }, { locationVerified: true }, { businessVerified: true }],
      },
    },
  });
});

test("granted badges stay in phone, location, business order", () => {
  const labels = grantedShopBadges({
    phoneVerified: false,
    locationVerified: true,
    businessVerified: true,
  }).map((badge) => badge.key);
  assert.deepEqual(labels, ["location", "business"]);
});

async function makeShop() {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = await prisma.user.create({
    data: {
      email: `badge-owner-${stamp}@example.com`,
      name: "Badge Owner",
      passwordHash: "x",
      city: "Nairobi",
      role: "user",
    },
  });
  const moderator = await prisma.user.create({
    data: {
      email: `badge-admin-${stamp}@example.com`,
      name: "Badge Admin",
      passwordHash: "x",
      city: "Nairobi",
      role: "admin",
    },
  });
  const shop = await prisma.storefront.create({
    data: { userId: owner.id, slug: `badge-shop-${stamp}`, published: true },
  });
  return { owner, moderator, shop, stamp };
}

async function removeShop(ownerId: string, adminId: string) {
  await prisma.user.delete({ where: { id: ownerId } });
  await prisma.user.delete({ where: { id: adminId } });
}

test("commit grants and removes with an append-only audit, and blocks a non-admin", async () => {
  const { owner, moderator, shop } = await makeShop();
  const actor = { id: moderator.id, email: moderator.email, name: moderator.name };
  const at = new Date("2026-09-21T09:30:00.000Z");
  try {
    const denied = await commitShopBadgeChange(prisma, {
      role: owner.role,
      storefrontId: shop.id,
      badge: "business",
      action: "grant",
      method: "visit",
      note: "Seller trying to self-verify",
      admin: actor,
    });
    assert.deepEqual(denied, { ok: false, code: "forbidden" });

    const granted = await commitShopBadgeChange(prisma, {
      role: "admin",
      storefrontId: shop.id,
      badge: "phone",
      action: "grant",
      method: "call",
      note: "  Spoke to the owner.  ",
      admin: actor,
      now: at,
    });
    assert.equal(granted.ok && granted.unchanged, false);

    const repeat = await commitShopBadgeChange(prisma, {
      role: "admin",
      storefrontId: shop.id,
      badge: "phone",
      action: "grant",
      method: "video",
      note: "Again",
      admin: actor,
    });
    assert.deepEqual(repeat, { ok: true, unchanged: true, slug: shop.slug, userId: owner.id });

    const removed = await commitShopBadgeChange(prisma, {
      role: "admin",
      storefrontId: shop.id,
      badge: "phone",
      action: "remove",
      note: "Number is no longer answered.",
      admin: actor,
      now: new Date("2026-09-28T15:00:00.000Z"),
    });
    assert.equal(removed.ok && removed.unchanged, false);

    const after = await prisma.storefront.findUniqueOrThrow({ where: { id: shop.id } });
    const events = await prisma.shopBadgeEvent.findMany({
      where: { storefrontId: shop.id },
      orderBy: { createdAt: "asc" },
    });

    assert.equal(after.phoneVerified, false);
    assert.equal(after.locationVerified, false);
    assert.equal(after.businessVerified, false);
    assert.equal(events.length, 2);
    assert.equal(events[0].action, "grant");
    assert.equal(events[0].badge, "phone");
    assert.equal(events[0].method, "call");
    assert.equal(events[0].note, "Spoke to the owner.");
    assert.equal(events[0].adminId, moderator.id);
    assert.equal(events[0].adminEmail, moderator.email);
    assert.equal(events[0].adminName, moderator.name);
    assert.equal(events[0].createdAt.toISOString(), at.toISOString());
    assert.equal(events[1].action, "remove");
    assert.equal(events[1].method, "");
    assert.equal(events[1].note, "Number is no longer answered.");
    assert.equal(events[1].adminId, moderator.id);
    assert.notEqual(events[0].id, events[1].id);
  } finally {
    await removeShop(owner.id, moderator.id);
  }
});

test("a missing shop and an over-long note do not write audit rows", async () => {
  const { owner, moderator, shop } = await makeShop();
  try {
    const missing = await commitShopBadgeChange(prisma, {
      role: "admin",
      storefrontId: "missing-shop",
      badge: "location",
      action: "grant",
      method: "visit",
      note: "",
      admin: { id: moderator.id, email: moderator.email, name: moderator.name },
    });
    assert.deepEqual(missing, { ok: false, code: "missing" });

    const tooLong = await commitShopBadgeChange(prisma, {
      role: "admin",
      storefrontId: shop.id,
      badge: "location",
      action: "grant",
      method: "documents",
      note: "n".repeat(281),
      admin: { id: moderator.id, email: moderator.email, name: moderator.name },
    });
    assert.deepEqual(tooLong, { ok: false, code: "invalid" });

    const noMethod = await commitShopBadgeChange(prisma, {
      role: "admin",
      storefrontId: shop.id,
      badge: "business",
      action: "grant",
      method: "",
      note: "Looked at a certificate",
      admin: { id: moderator.id, email: moderator.email, name: moderator.name },
    });
    assert.deepEqual(noMethod, { ok: false, code: "invalid" });

    const events = await prisma.shopBadgeEvent.count({ where: { storefrontId: shop.id } });
    const flags = await prisma.storefront.findUniqueOrThrow({ where: { id: shop.id } });
    assert.equal(events, 0);
    assert.equal(flags.locationVerified, false);
    assert.equal(flags.businessVerified, false);
  } finally {
    await removeShop(owner.id, moderator.id);
  }
});

test("paying for Verified Pro does not grant shop badges or write an audit row", async () => {
  const { owner, moderator, shop, stamp } = await makeShop();
  try {
    const payment = await prisma.payment.create({
      data: {
        userId: owner.id,
        product: "verified_pro",
        method: "card",
        amount: "£20",
        amountValue: 20,
        currency: "GBP",
        reference: `badge_pro_${stamp}`,
        provider: "flutterwave",
        status: "pending",
      },
    });
    const result = await fulfillPaidPayment({
      reference: payment.reference,
      providerId: "77",
      amount: 20,
      currency: "GBP",
      method: "card",
      testMode: true,
    });
    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    const shopAfter = await prisma.storefront.findUniqueOrThrow({ where: { id: shop.id } });
    const events = await prisma.shopBadgeEvent.count({ where: { storefrontId: shop.id } });

    assert.equal(result.ok, true);
    assert.equal(userAfter.verifiedPro, true);
    assert.equal(shopAfter.phoneVerified, false);
    assert.equal(shopAfter.locationVerified, false);
    assert.equal(shopAfter.businessVerified, false);
    assert.equal(events, 0);
  } finally {
    await removeShop(owner.id, moderator.id);
  }
});
