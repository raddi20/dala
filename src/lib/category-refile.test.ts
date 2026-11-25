import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildShouldApply,
  countByTarget,
  planRefile,
  validateRefileFiles,
  type CurrentListing,
  type RefileBackup,
  type RefileMapping,
} from "@/lib/category-refile";

const mapping: RefileMapping = {
  rows: [
    { entity: "listing", id: "a", title: "Rooms", from: "Food & restaurants", to: "Short stays", reason: "" },
    { entity: "listing", id: "b", title: "Sneakers", from: "Food & restaurants", to: "Fashion & clothing", reason: "" },
    { entity: "listing", id: "c", title: "Rice", from: "Retail / shops", to: "Groceries & produce", reason: "" },
  ],
};
const backup: RefileBackup = {
  rows: [
    { id: "a", category: "Food & restaurants" },
    { id: "b", category: "Food & restaurants" },
    { id: "c", category: "Retail / shops" },
  ],
};

function db(rows: [string, string, string?][]): Map<string, CurrentListing> {
  return new Map(rows.map(([id, category, email]) => [id, { id, category, ownerEmail: email ?? "seller@example.com" }]));
}

test("apply moves rows that still hold the expected value", () => {
  const plan = planRefile("apply", mapping, backup, db([["a", "Food & restaurants"], ["b", "Food & restaurants"], ["c", "Retail / shops"]]));
  assert.equal(plan.changes.length, 3);
  assert.deepEqual(plan.changes[0], { id: "a", title: "Rooms", from: "Food & restaurants", to: "Short stays" });
  assert.equal(plan.skipped.length, 0);
});

test("apply is idempotent and skips rows changed since the audit", () => {
  const plan = planRefile("apply", mapping, backup, db([["a", "Short stays"], ["b", "Electronics & phones"]]));
  assert.equal(plan.changes.length, 0);
  assert.deepEqual(plan.alreadyDone.map((row) => row.id), ["a"]);
  assert.deepEqual(
    plan.skipped.map((row) => [row.id, row.reason]),
    [
      ["b", 'Category is now "Electronics & phones", expected "Food & restaurants"'],
      ["c", "Listing not found"],
    ],
  );
});

test("demo listings are never touched", () => {
  const plan = planRefile("apply", mapping, backup, db([["a", "Food & restaurants", "peter@dala.local"]]));
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.skipped[0].reason, "Demo listing, left alone");
});

test("revert restores backup values only where the new value is still there", () => {
  const plan = planRefile("revert", mapping, backup, db([["a", "Short stays"], ["b", "Food & restaurants"], ["c", "Home & furniture"]]));
  assert.deepEqual(plan.changes, [{ id: "a", title: "Rooms", from: "Short stays", to: "Food & restaurants" }]);
  assert.deepEqual(plan.alreadyDone.map((row) => row.id), ["b"]);
  assert.deepEqual(plan.skipped.map((row) => row.id), ["c"]);
});

test("validation catches unknown categories, duplicates and backup gaps", () => {
  const bad: RefileMapping = {
    rows: [
      { entity: "listing", id: "a", title: "", from: "Food & restaurants", to: "Hotels", reason: "" },
      { entity: "listing", id: "a", title: "", from: "Food & restaurants", to: "Short stays", reason: "" },
      { entity: "listing", id: "z", title: "", from: "Retail / shops", to: "Short stays", reason: "" },
    ],
  };
  const problems = validateRefileFiles(bad, backup);
  assert.ok(problems.some((line) => line.includes('unknown to category "Hotels"')));
  assert.ok(problems.some((line) => line.includes("listed twice")));
  assert.ok(problems.some((line) => line.includes("z: missing from the backup")));
  assert.ok(problems.some((line) => line.includes("b: in the backup but not in the mapping")));
});

test("the deploy step applies once, then only reports", () => {
  const fresh = planRefile("apply", mapping, backup, db([["a", "Food & restaurants"], ["b", "Food & restaurants"], ["c", "Retail / shops"]]));
  assert.equal(buildShouldApply(fresh, 3), true);
  const later = planRefile("apply", mapping, backup, db([["a", "Short stays"], ["b", "Food & restaurants"], ["c", "Groceries & produce"]]));
  assert.equal(buildShouldApply(later, 3), false);
});

test("counts by target category", () => {
  const plan = planRefile("apply", mapping, backup, db([["a", "Food & restaurants"], ["b", "Food & restaurants"], ["c", "Retail / shops"]]));
  assert.deepEqual(countByTarget(plan.changes), [["Fashion & clothing", 1], ["Groceries & produce", 1], ["Short stays", 1]]);
});

test("the 25 November 2026 refile files are valid", () => {
  const real = JSON.parse(readFileSync("scripts/data/category-refile-2026-11-25.json", "utf8")) as RefileMapping;
  const saved = JSON.parse(readFileSync("scripts/data/category-refile-2026-11-25.backup.json", "utf8")) as RefileBackup;
  assert.deepEqual(validateRefileFiles(real, saved), []);
  assert.equal(real.rows.length, 104);
});
