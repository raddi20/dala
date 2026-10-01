import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, CATEGORY_GROUPS, HOME_CATEGORIES, ORIGINAL_CATEGORIES, categoryHref, isCategory } from "@/lib/categories";

test("original category names and home chips stay exactly as they were", () => {
  assert.deepEqual(HOME_CATEGORIES, ORIGINAL_CATEGORIES);
  assert.deepEqual([...ORIGINAL_CATEGORIES], [
    "Food & restaurants",
    "Professional services",
    "Beauty & personal care",
    "Construction & trades",
    "Transport & logistics",
    "Education & tutoring",
    "Events & entertainment",
    "Real estate / housing",
    "Auto & mechanics",
    "Faith & community orgs",
    "Retail / shops",
    "Health & wellness",
  ]);
  for (const name of ORIGINAL_CATEGORIES) {
    assert.equal(isCategory(name), true);
    assert.equal(categoryHref(name), `/listings?category=${encodeURIComponent(name)}`);
  }
  assert.equal(categoryHref("Real estate / housing"), "/listings?category=Real%20estate%20%2F%20housing");
});

test("every category is in one group, and the catalogue is the full set", () => {
  const seen = new Map<string, string>();
  for (const group of CATEGORY_GROUPS) {
    assert.ok(group.categories.length > 0);
    for (const category of group.categories) {
      assert.equal(seen.has(category), false, `${category} is in two groups`);
      seen.set(category, group.id);
      assert.equal(isCategory(category), true);
    }
  }
  assert.deepEqual(CATEGORIES, [...seen.keys()]);
  assert.equal(CATEGORIES.length, 40);
  assert.equal(isCategory("Not a category"), false);
});
