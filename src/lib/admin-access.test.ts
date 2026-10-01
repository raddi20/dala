import assert from "node:assert/strict";
import test from "node:test";
import {
  claimResetRequested,
  effectiveRole,
  matchUserByEmail,
  normalizeEmail,
  parseAdminEmailList,
  passwordLoginAllowed,
  planSecureAccounts,
  registrationBlockReason,
  roleForSeedUser,
  seedShouldSkip,
  showDemoCredentials,
  type AccountRow,
} from "./admin-access";

const demo: AccountRow = { id: "demo-admin", email: "akinyi@dala.local", role: "admin" };
const seller: AccountRow = { id: "seller", email: "atieno@dala.local", role: "user" };
const real: AccountRow = { id: "real", email: "shop@example.com", role: "user" };

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Admin@Rangach.co.ke "), "admin@rangach.co.ke");
});

test("parseAdminEmailList splits, dedupes, and rejects garbage", () => {
  const parsed = parseAdminEmailList(" admin@rangach.co.ke, Admin@Rangach.co.ke, ,not-an-email ");
  assert.deepEqual(parsed.emails, ["admin@rangach.co.ke"]);
  assert.deepEqual(parsed.invalid, ["not-an-email"]);
  assert.deepEqual(parseAdminEmailList(undefined), { emails: [], invalid: [] });
  assert.deepEqual(parseAdminEmailList("  ,  "), { emails: [], invalid: [] });
});

test("unset ADMIN_EMAIL locks demo accounts in production and promotes nobody", () => {
  const plan = planSecureAccounts([demo, seller, real], { VERCEL_ENV: "production" });
  assert.equal(plan.fatal, null);
  assert.equal(plan.adminConfigured, false);
  assert.deepEqual(plan.lockIds, ["demo-admin", "seller"]);
  assert.deepEqual(plan.claims, []);
});

test("production claim creates a missing admin and does not touch other passwords", () => {
  const plan = planSecureAccounts([demo, seller, real], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "a-long-claim-secret",
  });
  assert.equal(plan.fatal, null);
  assert.deepEqual(plan.lockIds, ["demo-admin", "seller"]);
  assert.deepEqual(plan.claims, [
    { email: "admin@rangach.co.ke", userId: null, storedEmail: null, action: "create" },
  ]);
  assert.equal(plan.claims.some((claim) => claim.userId === real.id), false);
});

test("existing non-admin with the reserved email is claimed, not trusted from sign-up", () => {
  const squatter: AccountRow = { id: "squat", email: "Admin@Rangach.co.ke", role: "user" };
  const plan = planSecureAccounts([squatter], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "a-long-claim-secret",
  });
  assert.equal(plan.fatal, null);
  assert.equal(plan.claims[0]?.action, "claim");
  assert.equal(plan.claims[0]?.userId, "squat");
  assert.equal(plan.claims[0]?.email, "admin@rangach.co.ke");
});

test("an admin stored with different email casing keeps the password", () => {
  const admin: AccountRow = { id: "admin", email: "Admin@Rangach.co.ke", role: "admin" };
  const plan = planSecureAccounts([admin], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "a-long-claim-secret",
  });
  assert.equal(plan.fatal, null);
  assert.equal(plan.claims[0]?.action, "normalize-email");
});

test("an admin who already claimed keeps their password", () => {
  const admin: AccountRow = { id: "admin", email: "admin@rangach.co.ke", role: "admin" };
  const plan = planSecureAccounts([demo, admin], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "a-long-claim-secret",
  });
  assert.equal(plan.fatal, null);
  assert.equal(plan.claims[0]?.action, "keep");
  assert.deepEqual(plan.lockIds, ["demo-admin"]);
});

test("ADMIN_CLAIM_RESET replaces the admin password only when asked", () => {
  const admin: AccountRow = { id: "admin", email: "admin@rangach.co.ke", role: "admin" };
  const plan = planSecureAccounts([admin], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "a-long-claim-secret",
    ADMIN_CLAIM_RESET: "1",
  });
  assert.equal(plan.claims[0]?.action, "reset");
  assert.equal(claimResetRequested("true"), true);
  assert.equal(claimResetRequested("no"), false);
  assert.equal(claimResetRequested(""), false);
});

test("a short claim secret or a demo admin email changes nothing", () => {
  const short = planSecureAccounts([demo], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "too-short",
  });
  assert.match(short.fatal ?? "", /16 to 72/);
  assert.match(short.fatal ?? "", /No accounts were changed/);
  assert.deepEqual(short.lockIds, []);
  assert.deepEqual(short.claims, []);

  const demoAdmin = planSecureAccounts([demo], {
    VERCEL_ENV: "production",
    ADMIN_EMAIL: "akinyi@dala.local",
    ADMIN_CLAIM_SECRET: "a-long-claim-secret",
  });
  assert.match(demoAdmin.fatal ?? "", /cannot be admin/);
  assert.deepEqual(demoAdmin.lockIds, []);
  assert.deepEqual(demoAdmin.claims, []);
});

test("preview and local builds do not plan password or role writes", () => {
  const users = [demo, seller, real];
  const env = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    ADMIN_EMAIL: "admin@rangach.co.ke",
    ADMIN_CLAIM_SECRET: "short",
  };
  const preview = planSecureAccounts(users, env);
  assert.equal(preview.production, false);
  assert.equal(preview.fatal, null);
  assert.deepEqual(preview.lockIds, []);
  assert.deepEqual(preview.claims, []);

  const local = planSecureAccounts(users, { ADMIN_EMAIL: "admin@rangach.co.ke" });
  assert.deepEqual(local.lockIds, []);
  assert.equal(local.fatal, null);
});

test("hosted demo login is refused and the login hint stays local", () => {
  assert.equal(passwordLoginAllowed("akinyi@dala.local", { VERCEL: "1", VERCEL_ENV: "production" }), false);
  assert.equal(passwordLoginAllowed("Akinyi@Dala.Local", { VERCEL_ENV: "preview" }), false);
  assert.equal(passwordLoginAllowed("akinyi@dala.local", {}), true);
  assert.equal(passwordLoginAllowed("admin@rangach.co.ke", { VERCEL_ENV: "production" }), true);
  assert.equal(showDemoCredentials({ VERCEL_ENV: "production" }), false);
  assert.equal(showDemoCredentials({}), true);
});

test("hosted requests ignore a demo admin role still stored in the database", () => {
  assert.equal(effectiveRole(demo, { VERCEL_ENV: "production" }), "user");
  assert.equal(effectiveRole(demo, {}), "admin");
  assert.equal(effectiveRole({ role: "admin", email: "admin@rangach.co.ke" }, { VERCEL: "1" }), "admin");
});

test("sign-up cannot take the reserved admin email or a demo email on the hosted site", () => {
  const env = { VERCEL_ENV: "production", ADMIN_EMAIL: "admin@rangach.co.ke" };
  assert.match(registrationBlockReason(" Admin@Rangach.co.ke ", env) ?? "", /reserved/);
  assert.match(registrationBlockReason("new@dala.local", env) ?? "", /Demo accounts/);
  assert.equal(registrationBlockReason("shop@example.com", env), null);
  assert.equal(registrationBlockReason("new@dala.local", {}), null);
  assert.equal(registrationBlockReason("shop@example.com", {}), null);
});

test("seed refuses to run when any user exists and will not seed a hosted demo admin", () => {
  assert.equal(seedShouldSkip(0), false);
  assert.equal(seedShouldSkip(8), true);
  assert.equal(roleForSeedUser("admin", "akinyi@dala.local", {}), "admin");
  assert.equal(roleForSeedUser("admin", "akinyi@dala.local", { VERCEL: "1" }), "user");
  assert.equal(roleForSeedUser("user", "atieno@dala.local", { VERCEL_ENV: "production" }), "user");
  assert.equal(roleForSeedUser("admin", "admin@rangach.co.ke", { VERCEL_ENV: "production" }), "admin");
});

test("email matching is case-insensitive and refuses two rows", () => {
  const rows = [
    { email: "Admin@Rangach.co.ke" },
    { email: "other@example.com" },
  ];
  assert.equal(matchUserByEmail(rows, " admin@rangach.co.ke ").status, "one");
  const dupes = [{ email: "A@Rangach.co.ke" }, { email: "a@rangach.co.ke" }];
  assert.equal(matchUserByEmail(dupes, "a@rangach.co.ke").status, "ambiguous");
});
