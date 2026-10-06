import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const root = join(import.meta.dirname, "..");
const migrationsDir = join(root, "prisma", "migrations");
const DAY_MS = 86_400_000;

function applyExistingMigrations(db) {
  const folders = readdirSync(migrationsDir)
    .filter((name) => /^\d/.test(name))
    .sort();
  assert.ok(folders.length >= 4, "expected the earlier migrations");
  for (const folder of folders) {
    const sql = readFileSync(join(migrationsDir, folder, "migration.sql"), "utf8");
    db.exec(sql);
  }
}

test("db push adds verifiedProUntil on a database that already has a Pro shop, then the grace step runs once", () => {
  const dir = mkdtempSync(join(tmpdir(), "rangach-pro-push-"));
  const file = join(dir, "existing.db");
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    applyExistingMigrations(db);
    const columnsBefore = db.prepare(`SELECT name FROM pragma_table_info('User')`).all().map((row) => row.name);
    assert.equal(columnsBefore.includes("verifiedProUntil"), false);
    db.exec(`
      INSERT INTO "User" ("id", "email", "name", "passwordHash", "verifiedPro", "updatedAt")
      VALUES
        ('user_free', 'free@example.com', 'Free Shop', 'hash', 0, CURRENT_TIMESTAMP),
        ('user_pro', 'pro@example.com', 'Pro Shop', 'hash', 1, CURRENT_TIMESTAMP);
      INSERT INTO "Storefront" ("id", "userId", "slug", "published", "bannerUrl", "updatedAt")
      VALUES
        ('shop_free', 'user_free', 'free-shop', 1, '', CURRENT_TIMESTAMP),
        ('shop_pro', 'user_pro', 'pro-shop', 1, 'https://cdn.example/cover.jpg', CURRENT_TIMESTAMP);
      INSERT INTO "Offering" ("id", "storefrontId", "title", "sortOrder", "updatedAt")
      VALUES
        ('off_1', 'shop_pro', 'Kept offering', 0, CURRENT_TIMESTAMP),
        ('off_2', 'shop_pro', 'Also kept', 1, CURRENT_TIMESTAMP);
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

    const afterPush = new DatabaseSync(file);
    const pro = afterPush.prepare(`SELECT "email", "verifiedPro", "verifiedProUntil" FROM "User" WHERE "id" = 'user_pro'`).get();
    const free = afterPush.prepare(`SELECT "verifiedPro", "verifiedProUntil" FROM "User" WHERE "id" = 'user_free'`).get();
    const shop = afterPush.prepare(`SELECT "slug", "bannerUrl", "published" FROM "Storefront" WHERE "id" = 'shop_pro'`).get();
    const offerings = afterPush.prepare(`SELECT COUNT(*) AS n FROM "Offering" WHERE "storefrontId" = 'shop_pro'`).get();
    afterPush.close();

    assert.equal(pro.email, "pro@example.com");
    assert.equal(Number(pro.verifiedPro), 1);
    assert.equal(pro.verifiedProUntil, null);
    assert.equal(Number(free.verifiedPro), 0);
    assert.equal(free.verifiedProUntil, null);
    assert.equal(shop.slug, "pro-shop");
    assert.equal(shop.bannerUrl, "https://cdn.example/cover.jpg");
    assert.equal(Number(shop.published), 1);
    assert.equal(Number(offerings.n), 2);

    const started = Date.now();
    const filled = spawnSync(process.execPath, ["--import", "tsx", "scripts/backfill-pro-until.ts"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: `file:${file}` },
    });
    const fillOut = `${filled.stdout ?? ""}\n${filled.stderr ?? ""}`;
    assert.equal(filled.status, 0, fillOut);
    assert.match(fillOut, /1 existing Pro shop/);

    const afterFill = new DatabaseSync(file);
    const proFilled = afterFill.prepare(`SELECT "verifiedPro", "verifiedProUntil" FROM "User" WHERE "id" = 'user_pro'`).get();
    const freeFilled = afterFill.prepare(`SELECT "verifiedProUntil" FROM "User" WHERE "id" = 'user_free'`).get();
    afterFill.close();

    assert.equal(Number(proFilled.verifiedPro), 1);
    assert.equal(freeFilled.verifiedProUntil, null);
    const until = new Date(proFilled.verifiedProUntil);
    const expected = started + 30 * DAY_MS;
    assert.ok(Math.abs(until.getTime() - expected) < 60_000, `${proFilled.verifiedProUntil} is not about 30 days out`);

    const again = spawnSync(process.execPath, ["--import", "tsx", "scripts/backfill-pro-until.ts"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: `file:${file}` },
    });
    const againOut = `${again.stdout ?? ""}\n${again.stderr ?? ""}`;
    assert.equal(again.status, 0, againOut);
    assert.match(againOut, /No existing Pro shops needed a grace date/);

    const afterAgain = new DatabaseSync(file);
    const proAgain = afterAgain.prepare(`SELECT "verifiedProUntil" FROM "User" WHERE "id" = 'user_pro'`).get();
    const offeringAgain = afterAgain.prepare(`SELECT "title" FROM "Offering" WHERE "id" = 'off_1'`).get();
    afterAgain.close();
    assert.equal(proAgain.verifiedProUntil, proFilled.verifiedProUntil);
    assert.equal(offeringAgain.title, "Kept offering");
  } finally {
    try {
      db.close();
    } catch {
      // already closed after the push
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
