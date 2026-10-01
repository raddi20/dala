import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const root = join(import.meta.dirname, "..");
const migrationsDir = join(root, "prisma", "migrations");

function applyMigrationsExceptAi(db) {
  const folders = readdirSync(migrationsDir)
    .filter((name) => /^\d/.test(name) && !name.startsWith("20261002"))
    .sort();
  assert.ok(folders.length >= 5, "expected the earlier migrations");
  for (const folder of folders) {
    const sql = readFileSync(join(migrationsDir, folder, "migration.sql"), "utf8");
    db.exec(sql);
  }
}

test("db push adds AI tables without rewriting existing rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "rangach-ai-push-"));
  const file = join(dir, "existing.db");
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    applyMigrationsExceptAi(db);
    db.exec(`
      INSERT INTO "User" ("id", "email", "name", "passwordHash", "updatedAt")
      VALUES ('user_keep', 'keep@example.com', 'Keep Me', 'hash', CURRENT_TIMESTAMP);
      INSERT INTO "Storefront" ("id", "userId", "slug", "published", "updatedAt")
      VALUES ('shop_keep', 'user_keep', 'keep-me', 1, CURRENT_TIMESTAMP);
      INSERT INTO "Listing" (
        "id", "type", "title", "description", "category", "city", "region", "ownerId", "updatedAt"
      ) VALUES (
        'listing_keep', 'business', 'Kept listing', 'Already here.', 'Food & restaurants',
        'Nairobi', 'homeland', 'user_keep', CURRENT_TIMESTAMP
      );
    `);
    db.close();

    const pushed = spawnSync(process.execPath, ["scripts/db-push.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: `file:${file}` },
    });
    const output = `${pushed.stdout ?? ""}\n${pushed.stderr ?? ""}`;
    assert.equal(pushed.status, 0, output);
    assert.equal(output.includes("--accept-data-loss"), false, output);

    const after = new DatabaseSync(file);
    const user = after.prepare(`SELECT "email", "name" FROM "User" WHERE "id" = 'user_keep'`).get();
    const shop = after.prepare(`SELECT "slug", "published" FROM "Storefront" WHERE "id" = 'shop_keep'`).get();
    const listing = after.prepare(`SELECT "title", "hidden" FROM "Listing" WHERE "id" = 'listing_keep'`).get();
    const usage = after.prepare(`SELECT COUNT(*) AS n FROM "AiUsage"`).get();
    const flags = after.prepare(`SELECT COUNT(*) AS n FROM "AiFlag"`).get();
    const stats = after.prepare(`SELECT COUNT(*) AS n FROM "StatEvent"`).get();
    const videos = after.prepare(`SELECT COUNT(*) AS n FROM "ShopVideo"`).get();
    const receipts = after.prepare(`SELECT COUNT(*) AS n FROM "MuxEventReceipt"`).get();
    const cache = after.prepare(`SELECT COUNT(*) AS n FROM "AiSearchCache"`).get();
    const drafts = after.prepare(`SELECT COUNT(*) AS n FROM "AiListingDraft"`).get();
    const prefs = after.prepare(`SELECT COUNT(*) AS n FROM "SellerAiPrefs"`).get();
    const moderationFlags = after.prepare(`SELECT COUNT(*) AS n FROM "ModerationFlag"`).get();
    const reviews = after.prepare(`SELECT COUNT(*) AS n FROM "ModerationReview"`).get();
    const hashes = after.prepare(`SELECT COUNT(*) AS n FROM "MediaHash"`).get();
    const tips = after.prepare(`SELECT COUNT(*) AS n FROM "AiSellerTip"`).get();
    after.close();

    assert.equal(user.email, "keep@example.com");
    assert.equal(user.name, "Keep Me");
    assert.equal(shop.slug, "keep-me");
    assert.equal(Number(shop.published), 1);
    assert.equal(listing.title, "Kept listing");
    assert.equal(Number(listing.hidden), 0);
    assert.equal(Number(usage.n), 0);
    assert.equal(Number(flags.n), 0);
    assert.equal(Number(stats.n), 0);
    assert.equal(Number(videos.n), 0);
    assert.equal(Number(receipts.n), 0);
    assert.equal(Number(cache.n), 0);
    assert.equal(Number(drafts.n), 0);
    assert.equal(Number(prefs.n), 0);
    assert.equal(Number(moderationFlags.n), 0);
    assert.equal(Number(reviews.n), 0);
    assert.equal(Number(hashes.n), 0);
    assert.equal(Number(tips.n), 0);
  } finally {
    try {
      db.close();
    } catch {
      // already closed after the push
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
