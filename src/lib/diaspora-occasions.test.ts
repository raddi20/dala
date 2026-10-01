import assert from "node:assert/strict";
import test from "node:test";
import { diasporaOrdersWhere } from "@/lib/diaspora";
import { commitOccasionCuration, planOccasionCuration } from "@/lib/occasion-curation";
import { ensureOccasionDefinitions, type OccasionDefinition } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/search";

test("the diaspora filter matches only shops that opted in", () => {
  assert.equal(diasporaOrdersWhere(false), null);
  assert.equal(diasporaOrdersWhere(""), null);
  assert.equal(diasporaOrdersWhere("0"), null);
  assert.deepEqual(diasporaOrdersWhere(true), { owner: { storefront: { is: { servesDiaspora: true } } } });
  assert.deepEqual(diasporaOrdersWhere("1"), { owner: { storefront: { is: { servesDiaspora: true } } } });
});

test("browse search keeps shops that serve diaspora orders and drops the rest", async () => {
  const stamp = Date.now().toString(36);
  const yesOwner = await prisma.user.create({
    data: {
      email: `diaspora-yes-${stamp}@example.com`,
      name: "Diaspora Yes",
      passwordHash: "x",
      city: "Nairobi",
    },
  });
  const noOwner = await prisma.user.create({
    data: {
      email: `diaspora-no-${stamp}@example.com`,
      name: "Diaspora No",
      passwordHash: "x",
      city: "Nairobi",
    },
  });
  try {
    await prisma.storefront.create({
      data: { userId: yesOwner.id, slug: `diaspora-yes-${stamp}`, published: true, servesDiaspora: true },
    });
    await prisma.storefront.create({
      data: { userId: noOwner.id, slug: `diaspora-no-${stamp}`, published: true, servesDiaspora: false },
    });
    const yes = await prisma.listing.create({
      data: {
        type: "business",
        title: `Catering ${stamp}`,
        description: "Weekend pots for a visit home.",
        category: "Food & restaurants",
        city: "Nairobi",
        region: "homeland",
        contactWhatsapp: "+254711000101",
        ownerId: yesOwner.id,
      },
    });
    const no = await prisma.listing.create({
      data: {
        type: "business",
        title: `Salon ${stamp}`,
        description: "A local salon with no diaspora orders.",
        category: "Beauty & personal care",
        city: "Nairobi",
        region: "homeland",
        ownerId: noOwner.id,
      },
    });

    const hits = await searchListings({ q: stamp, diaspora: true });
    const ids = hits.map((listing) => listing.id);
    assert.deepEqual(ids, [yes.id]);
    assert.equal(hits[0]?.owner.storefront?.servesDiaspora, true);
    assert.equal(ids.includes(no.id), false);

    const all = await searchListings({ q: stamp });
    assert.equal(all.length, 2);
  } finally {
    await prisma.user.delete({ where: { id: yesOwner.id } });
    await prisma.user.delete({ where: { id: noOwner.id } });
  }
});

test("occasion bootstrap creates a missing page and never overwrites an edit", async () => {
  const slug = `gathering-${Date.now().toString(36)}`;
  const definition: OccasionDefinition = {
    slug,
    title: "Test gathering",
    sortOrder: 900,
    intro: "Original intro from the definition.",
  };
  try {
    const first = await ensureOccasionDefinitions(prisma, [definition]);
    assert.deepEqual(first.created, [slug]);
    const created = await prisma.occasion.findUniqueOrThrow({ where: { slug } });
    assert.equal(created.intro, definition.intro);

    await prisma.occasion.update({
      where: { id: created.id },
      data: { intro: "Kevin rewrote this intro.", title: "Kevin's gathering" },
    });
    const second = await ensureOccasionDefinitions(prisma, [definition]);
    assert.deepEqual(second.created, []);
    const kept = await prisma.occasion.findUniqueOrThrow({ where: { slug } });
    assert.equal(kept.id, created.id);
    assert.equal(kept.intro, "Kevin rewrote this intro.");
    assert.equal(kept.title, "Kevin's gathering");
    assert.equal(await prisma.occasion.count({ where: { slug } }), 1);
  } finally {
    await prisma.occasion.deleteMany({ where: { slug } });
  }
});

test("the real occasion list is inserted once and a later run leaves it", async () => {
  const first = await ensureOccasionDefinitions(prisma);
  const slugs = first.created;
  const again = await ensureOccasionDefinitions(prisma);
  assert.deepEqual(again.created, []);
  const rows = await prisma.occasion.findMany({
    where: { slug: { in: ["homecomings", "weddings-dowry", "funerals", "christmas-at-home", "house-back-home"] } },
  });
  assert.equal(rows.length, 5);
  if (slugs.includes("weddings-dowry")) {
    const wedding = rows.find((row) => row.slug === "weddings-dowry");
    assert.match(wedding?.title ?? "", /ayie/i);
  }
});

test("only an admin can plan occasion copy, tags, or pins", () => {
  for (const role of ["user", "Admin", "", "moderator"]) {
    const result = planOccasionCuration({
      role,
      action: "save-copy",
      occasionId: "occ_1",
      intro: "New words",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "forbidden");
  }
  const pin = planOccasionCuration({
    role: "user",
    action: "pin-shop",
    occasionId: "occ_1",
    storefrontId: "shop_1",
  });
  assert.equal(pin.ok, false);

  const saved = planOccasionCuration({
    role: "admin",
    action: "save-copy",
    occasionId: " occ_1 ",
    intro: "  Hello family.  ",
    title: "  Homecomings  ",
  });
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.occasionId, "occ_1");
    assert.equal(saved.intro, "Hello family.");
    assert.equal(saved.title, "Homecomings");
  }
  assert.equal(
    planOccasionCuration({ role: "admin", action: "pin-shop", occasionId: "occ_1", storefrontId: "" }).ok,
    false,
  );
  assert.equal(planOccasionCuration({ role: "admin", action: "drop", occasionId: "occ_1" }).ok, false);
});

test("a non-admin curation commit does not change the page, and an admin pin does", async () => {
  const stamp = Date.now().toString(36);
  const slug = `curation-${stamp}`;
  const owner = await prisma.user.create({
    data: { email: `curation-${stamp}@example.com`, name: "Curated Shop", passwordHash: "x" },
  });
  try {
    await ensureOccasionDefinitions(prisma, [
      { slug, title: "Curation test", sortOrder: 901, intro: "Leave this until an admin writes." },
    ]);
    const occasion = await prisma.occasion.findUniqueOrThrow({ where: { slug } });
    const shop = await prisma.storefront.create({
      data: { userId: owner.id, slug: `curation-${stamp}`, published: true },
    });

    const denied = await commitOccasionCuration(prisma, {
      role: "user",
      action: "save-copy",
      occasionId: occasion.id,
      intro: "A seller tried to rewrite the intro.",
      title: "Taken over",
    });
    assert.deepEqual(denied, { ok: false, code: "forbidden" });
    const untouched = await prisma.occasion.findUniqueOrThrow({ where: { id: occasion.id } });
    assert.equal(untouched.intro, "Leave this until an admin writes.");
    assert.equal(untouched.title, "Curation test");

    const deniedPin = await commitOccasionCuration(prisma, {
      role: "user",
      action: "pin-shop",
      occasionId: occasion.id,
      storefrontId: shop.id,
    });
    assert.equal(deniedPin.ok, false);
    assert.equal(await prisma.shopOccasion.count({ where: { occasionId: occasion.id } }), 0);

    const saved = await commitOccasionCuration(prisma, {
      role: "admin",
      action: "save-copy",
      occasionId: occasion.id,
      intro: "  Admin intro for the visit home.  ",
      title: "Visits home",
    });
    assert.equal(saved.ok, true);
    const written = await prisma.occasion.findUniqueOrThrow({ where: { id: occasion.id } });
    assert.equal(written.intro, "Admin intro for the visit home.");
    assert.equal(written.title, "Visits home");

    const tagged = await commitOccasionCuration(prisma, {
      role: "admin",
      action: "tag-shop",
      occasionId: occasion.id,
      storefrontId: shop.id,
    });
    assert.equal(tagged.ok, true);
    const added = await prisma.shopOccasion.findUniqueOrThrow({
      where: { occasionId_storefrontId: { occasionId: occasion.id, storefrontId: shop.id } },
    });
    assert.equal(added.pinned, false);

    const pinned = await commitOccasionCuration(prisma, {
      role: "admin",
      action: "pin-shop",
      occasionId: occasion.id,
      storefrontId: shop.id,
    });
    assert.equal(pinned.ok, true);
    const tag = await prisma.shopOccasion.findUniqueOrThrow({
      where: { occasionId_storefrontId: { occasionId: occasion.id, storefrontId: shop.id } },
    });
    assert.equal(tag.pinned, true);

    const retagged = await commitOccasionCuration(prisma, {
      role: "admin",
      action: "tag-shop",
      occasionId: occasion.id,
      storefrontId: shop.id,
    });
    assert.equal(retagged.ok, true);
    const stillPinned = await prisma.shopOccasion.findUniqueOrThrow({
      where: { occasionId_storefrontId: { occasionId: occasion.id, storefrontId: shop.id } },
    });
    assert.equal(stillPinned.pinned, true);

    const removed = await commitOccasionCuration(prisma, {
      role: "admin",
      action: "untag-shop",
      occasionId: occasion.id,
      storefrontId: shop.id,
    });
    assert.equal(removed.ok, true);
    assert.equal(await prisma.shopOccasion.count({ where: { occasionId: occasion.id } }), 0);
    const still = await prisma.occasion.findUniqueOrThrow({ where: { id: occasion.id } });
    assert.equal(still.intro, "Admin intro for the visit home.");
  } finally {
    await prisma.occasion.deleteMany({ where: { slug } });
    await prisma.user.delete({ where: { id: owner.id } });
  }
});
