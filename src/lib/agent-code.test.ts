import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import {
  AGENT_COOKIE,
  AGENT_COOKIE_MAX_AGE,
  AGENT_NONE,
  agentCodeToStore,
  agentCookieOptions,
  countAgentSignups,
  normalizeAgentCode,
  referralForNewAccount,
} from "@/lib/agent-code";
import { createRegisteredUser, type RegisterUserDb } from "@/lib/register-user";

test("agent codes are short, alphanumeric, and uppercase", () => {
  assert.equal(normalizeAgentCode("a1"), "A1");
  assert.equal(normalizeAgentCode("  a4 "), "A4");
  assert.equal(normalizeAgentCode("agent16"), "AGENT16");
  assert.equal(normalizeAgentCode("A".repeat(16)), "A".repeat(16));
  assert.equal(normalizeAgentCode("A".repeat(17)), null);
  assert.equal(normalizeAgentCode(""), null);
  assert.equal(normalizeAgentCode("   "), null);
  assert.equal(normalizeAgentCode("A-1"), null);
  assert.equal(normalizeAgentCode("A 1"), null);
  assert.equal(normalizeAgentCode("hello!"), null);
  assert.equal(normalizeAgentCode("A1<script>"), null);
  assert.equal(normalizeAgentCode(null), null);
  assert.equal(normalizeAgentCode(12), null);
});

test("the cookie is first-touch unless a new valid code arrives", () => {
  assert.equal(agentCodeToStore(undefined, "a1"), "A1");
  assert.equal(agentCodeToStore("", "A2"), "A2");
  assert.equal(agentCodeToStore("A1", "a1"), null);
  assert.equal(agentCodeToStore("A1", "A2"), "A2");
  assert.equal(agentCodeToStore("A1", "not a code"), null);
  assert.equal(agentCodeToStore("A1", ""), null);
  assert.equal(agentCodeToStore("A1", null), null);
  assert.equal(agentCodeToStore("junk!!", "b3"), "B3");
  assert.equal(agentCodeToStore("junk!!", "still junk"), null);
});

test("a visit with ?agent= sets the cookie, and junk does not", () => {
  const first = proxy(new NextRequest("https://www.rangach.co.ke/welcome?agent=a1"));
  const set = first.cookies.get(AGENT_COOKIE);
  assert.equal(set?.value, "A1");
  assert.equal(set?.httpOnly, true);
  assert.equal(set?.sameSite, "lax");
  assert.equal(set?.path, "/");
  assert.equal(set?.maxAge, AGENT_COOKIE_MAX_AGE);
  assert.equal(set?.secure, true);
  assert.deepEqual(agentCookieOptions(false).secure, false);

  const again = proxy(new NextRequest("https://www.rangach.co.ke/list?agent=a1", { headers: { cookie: `${AGENT_COOKIE}=A1` } }));
  assert.equal(again.cookies.get(AGENT_COOKIE), undefined);

  const junk = proxy(new NextRequest("https://www.rangach.co.ke/?agent=nope!", { headers: { cookie: `${AGENT_COOKIE}=A1` } }));
  assert.equal(junk.cookies.get(AGENT_COOKIE), undefined);

  const replaced = proxy(new NextRequest("http://localhost:3000/listings?agent=a3", { headers: { cookie: `${AGENT_COOKIE}=A1` } }));
  const next = replaced.cookies.get(AGENT_COOKIE);
  assert.equal(next?.value, "A3");
  assert.equal(next?.secure, false);

  const plain = proxy(new NextRequest("https://www.rangach.co.ke/welcome"));
  assert.equal(plain.cookies.get(AGENT_COOKIE), undefined);
});

test("a new account stores the code, and an existing account is not overwritten", async () => {
  type Row = {
    id: string;
    email: string;
    referralAgentCode: string | null;
    referralAgentAt: Date | null;
  };
  const rows = new Map<string, Row>();
  let creates = 0;
  const db: RegisterUserDb = {
    async findByEmail(email) {
      const row = rows.get(email);
      return row ? { referralAgentCode: row.referralAgentCode } : null;
    },
    async create(data) {
      creates += 1;
      const row: Row = { id: `user-${creates}`, ...data };
      rows.set(data.email, row);
      return { id: row.id, referralAgentCode: row.referralAgentCode };
    },
  };
  const now = new Date("2026-10-09T12:00:00.000Z");
  const input = {
    name: "Akinyi",
    email: "akinyi@example.com",
    passwordHash: "hash",
    kind: "business",
    city: "Nairobi",
  };

  const blank = referralForNewAccount("!!!");
  assert.equal(blank.referralAgentCode, null);
  assert.equal(blank.referralAgentAt, null);

  const first = await createRegisteredUser(db, { ...input, agentCookie: " a1 ", now });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.referralAgentCode, "A1");
  const stored = rows.get(input.email);
  assert.equal(stored?.referralAgentCode, "A1");
  assert.equal(stored?.referralAgentAt?.toISOString(), now.toISOString());

  const second = await createRegisteredUser(db, { ...input, agentCookie: "A2", now: new Date("2026-10-10T00:00:00.000Z") });
  assert.deepEqual(second, { ok: false, error: "That email is already registered." });
  assert.equal(creates, 1);
  assert.equal(rows.get(input.email)?.referralAgentCode, "A1");
  assert.equal(rows.get(input.email)?.referralAgentAt?.toISOString(), now.toISOString());

  const quiet = await createRegisteredUser(db, { ...input, email: "other@example.com", agentCookie: "bad code" });
  assert.equal(quiet.ok, true);
  assert.equal(rows.get("other@example.com")?.referralAgentCode, null);
  assert.equal(rows.get("other@example.com")?.referralAgentAt, null);
});

test("admin counts sign-ups, shops, and first listings, including none", () => {
  const rows = countAgentSignups([
    { code: null, hasShop: false, hasListing: false },
    { code: "  ", hasShop: true, hasListing: false },
    { code: "A1", hasShop: true, hasListing: true },
    { code: "A1", hasShop: true, hasListing: false },
    { code: "A2", hasShop: false, hasListing: true },
  ]);
  assert.deepEqual(rows, [
    { code: "A1", signups: 2, shops: 2, firstListings: 1 },
    { code: "A2", signups: 1, shops: 0, firstListings: 1 },
    { code: AGENT_NONE, signups: 2, shops: 1, firstListings: 0 },
  ]);

  const empty = countAgentSignups([]);
  assert.deepEqual(empty, [{ code: AGENT_NONE, signups: 0, shops: 0, firstListings: 0 }]);
});
