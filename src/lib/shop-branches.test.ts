import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  backfillBranchRows,
  backfillShopBranches,
  branchPlaceSuffix,
  branchSavePlan,
  branchTowns,
  effectiveBranches,
  parseBranchesField,
  uniqueById,
  validateBranches,
} from "@/lib/shop-branches";
import { shopBranchesJsonLd } from "@/lib/seo";

const SQLITE = { DATABASE_URL: "file:./dev.db" };

test("backfill copies the current town and phone into a first branch", () => {
  const rows = backfillBranchRows([
    { id: "s1", branchCount: 0, user: { city: "kisumu", phone: "+254712345678" } },
    { id: "s2", branchCount: 2, user: { city: "Siaya", phone: "" } },
    { id: "s3", branchCount: 0, user: { city: "", phone: " " } },
  ]);
  assert.deepEqual(rows, [
    { storefrontId: "s1", town: "Kisumu", address: "", phone: "+254712345678", hours: "", sortOrder: 0 },
    { storefrontId: "s3", town: "Nairobi", address: "", phone: "", hours: "", sortOrder: 0 },
  ]);
});

test("backfill is idempotent: a second run creates nothing", async () => {
  const branches: { storefrontId: string }[] = [];
  const db = {
    storefront: {
      findMany: async () =>
        [{ id: "s1", user: { city: "Kisumu", phone: "" } }].map((shop) => ({
          ...shop,
          _count: { branches: branches.filter((row) => row.storefrontId === shop.id).length },
        })),
    },
    shopBranch: {
      createMany: async ({ data }: { data: { storefrontId: string }[] }) => {
        branches.push(...data);
        return { count: data.length };
      },
    },
  };
  assert.equal(await backfillShopBranches(db), 1);
  assert.equal(await backfillShopBranches(db), 0);
  assert.equal(branches.length, 1);
});

test("a shop with no saved branch reads its legacy town as one branch", () => {
  const legacy = effectiveBranches({ branches: [], user: { city: "Homa Bay", phone: "+254700000001" } });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].town, "Homa Bay");
  assert.equal(legacy[0].phone, "+254700000001");
  const saved = effectiveBranches({
    branches: [
      { id: "b", town: "Siaya", address: "", phone: "", hours: "", sortOrder: 1 },
      { id: "a", town: "Kisumu", address: "", phone: "", hours: "", sortOrder: 0 },
    ],
    user: { city: "Nairobi" },
  });
  assert.deepEqual(branchTowns(saved), ["Kisumu", "Siaya"]);
  assert.equal(branchPlaceSuffix(branchTowns(saved)), " +1 town");
  assert.equal(branchPlaceSuffix(["Kisumu"]), "");
});

test("branch validation: at least one, known town, phone and lengths checked", () => {
  assert.equal(validateBranches([]).ok, false);
  assert.equal(validateBranches("nope").ok, false);
  assert.match((validateBranches([{ town: "Atlantis" }]) as { error: string }).error, /choose a town/);
  assert.match((validateBranches([{ town: "Kisumu", phone: "abc" }]) as { error: string }).error, /Branch 1/);
  assert.match((validateBranches([{ town: "Kisumu", address: "x".repeat(200) }]) as { error: string }).error, /address/);
  assert.match((validateBranches([{ town: "Kisumu", hours: "x".repeat(200) }]) as { error: string }).error, /hours/);
  assert.match(
    (validateBranches([{ town: "Kisumu" }, { town: "kisumu" }]) as { error: string }).error,
    /repeats/,
  );
  assert.equal(validateBranches(Array.from({ length: 21 }, (_, i) => ({ town: "Kisumu", address: `${i}` }))).ok, false);
  const ok = validateBranches([
    { id: "b1", town: "kisumu", address: "  Oginga Odinga St ", phone: "0712 345 678", hours: "Mon–Sat 8–6" },
    { town: "Siaya" },
  ]);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.branches[0], {
      id: "b1",
      town: "Kisumu",
      address: "Oginga Odinga St",
      phone: "+254712345678",
      hours: "Mon–Sat 8–6",
      sortOrder: 0,
    });
    assert.equal(ok.branches[1].sortOrder, 1);
  }
  assert.equal(parseBranchesField("{bad").ok, false);
  assert.equal(parseBranchesField(null).ok, false);
});

test("save plan updates owned ids, creates new rows, deletes dropped ones, never touches foreign ids", () => {
  const plan = branchSavePlan(["a", "b"], [
    { id: "a", town: "Kisumu", address: "", phone: "", hours: "", sortOrder: 0 },
    { id: "other-shop", town: "Siaya", address: "", phone: "", hours: "", sortOrder: 1 },
    { town: "Bondo", address: "", phone: "", hours: "", sortOrder: 2 },
  ]);
  assert.deepEqual(plan.update.map((row) => row.id), ["a"]);
  assert.equal(plan.create.length, 2);
  assert.deepEqual(plan.remove, ["b"]);
});

test("town filter matches the legacy town or any branch town", async () => {
  const { searchShopsWhereForTest } = await import("@/lib/search");
  const where = JSON.stringify(searchShopsWhereForTest({ city: "Siaya" }, SQLITE));
  assert.match(where, /"branches":\{"some":\{"town":\{"contains":"Siaya"\}\}\}/);
  assert.match(where, /"user":\{"OR":\[\{"city":\{"contains":"Siaya"\}\}/);
  assert.match(where, /"OR":\[\{"user"/);
  const none = JSON.stringify(searchShopsWhereForTest({}, SQLITE));
  assert.doesNotMatch(none, /branches/);
});

test("listings stay on the shop: branches never copy listings", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const branchModel = schema.split("model ShopBranch {")[1].split("}")[0];
  assert.doesNotMatch(branchModel, /Listing|Offering/);
  const listing = { id: "l1" };
  assert.deepEqual(uniqueById([listing, listing, { id: "l2" }]).map((row) => row.id), ["l1", "l2"]);
});

test("shop JSON-LD lists each branch location once", () => {
  const data = shopBranchesJsonLd("https://www.rangach.co.ke", { name: "Mama Akinyi", slug: "mama" }, [
    { town: "Kisumu", address: "Oginga Odinga St", phone: "+254712345678" },
    { town: "Siaya", address: "", phone: "" },
  ]) as Record<string, unknown>;
  assert.equal(data["@type"], "LocalBusiness");
  assert.equal((data.address as Record<string, string>).addressLocality, "Kisumu");
  const departments = data.department as Record<string, unknown>[];
  assert.equal(departments.length, 1);
  assert.equal((departments[0].address as Record<string, string>).addressLocality, "Siaya");
});

test("migration is additive and creates only the branch table", () => {
  const sql = readFileSync("prisma/migrations/20261103170000_shop_branches/migration.sql", "utf8");
  assert.match(sql, /CREATE TABLE "ShopBranch"/);
  assert.doesNotMatch(sql, /DROP|ALTER TABLE "(Storefront|User)"/);
});

test("local DB: a shop with branches in two towns shows once in each town filter and once unfiltered", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { searchShops } = await import("@/lib/search");
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `branches-${stamp}@test.local`, name: `Branch Test ${stamp}`, passwordHash: "x", city: "Nairobi", bio: "" },
  });
  try {
    const shop = await prisma.storefront.create({
      data: {
        userId: user.id,
        slug: `branch-test-${stamp}`,
        published: true,
        offerings: { create: [{ title: "Branch test fish", sortOrder: 0 }] },
        branches: {
          create: [
            { town: "Kisumu", sortOrder: 0 },
            { town: "Siaya", sortOrder: 1 },
          ],
        },
      },
    });
    for (const city of ["Kisumu", "Siaya"]) {
      const result = await searchShops({ city, pageSize: 200 });
      assert.equal(result.shops.filter((row) => row.id === shop.id).length, 1, city);
      const card = result.shops.find((row) => row.id === shop.id);
      assert.deepEqual(card?.branchTowns, ["Kisumu", "Siaya"]);
    }
    const homa = await searchShops({ city: "Homa Bay", pageSize: 200 });
    assert.equal(homa.shops.some((row) => row.id === shop.id), false);
    const all = await searchShops({ q: `Branch Test ${stamp}`, pageSize: 200 });
    assert.equal(all.shops.filter((row) => row.id === shop.id).length, 1);
    assert.equal(await prisma.offering.count({ where: { storefrontId: shop.id } }), 1);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
