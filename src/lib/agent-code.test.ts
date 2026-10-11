import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import {
  AGENT_COOKIE,
  AGENT_COOKIE_MAX_AGE,
  AGENT_NONE,
  AGENT_OTHER,
  agentCodeToStore,
  agentCookieOptions,
  agentPresetRange,
  countAgentSignups,
  knownAgentCodes,
  normalizeAgentCode,
  referralForNewAccount,
  resolveAgentRange,
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
  assert.equal(agentCodeToStore("junk!!", "b3"), null);
  assert.equal(agentCodeToStore("junk!!", "a2"), "A2");
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

  const unknown = proxy(new NextRequest("https://www.rangach.co.ke/welcome?agent=b9"));
  assert.equal(unknown.cookies.get(AGENT_COOKIE), undefined);

  const unknownKeeps = proxy(
    new NextRequest("https://www.rangach.co.ke/?agent=ZZ", { headers: { cookie: `${AGENT_COOKIE}=A1` } }),
  );
  assert.equal(unknownKeeps.cookies.get(AGENT_COOKIE), undefined);

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

  const unknownCode = await createRegisteredUser(db, { ...input, email: "third@example.com", agentCookie: "B9" });
  assert.equal(unknownCode.ok, true);
  assert.equal(rows.get("third@example.com")?.referralAgentCode, null);
});

test("admin counts sign-ups, shops, offerings, and directory listings, including none", () => {
  const rows = countAgentSignups([
    { code: null, hasShop: false, hasOffering: false, hasListing: false },
    { code: "  ", hasShop: true, hasOffering: false, hasListing: false },
    { code: "A1", hasShop: true, hasOffering: true, hasListing: true },
    { code: "A1", hasShop: true, hasOffering: true, hasListing: false },
    { code: "A2", hasShop: false, hasOffering: false, hasListing: true },
  ]);
  assert.deepEqual(rows, [
    { code: "A1", signups: 2, shops: 2, publishedShops: 0, firstOfferings: 2, directoryListings: 1 },
    { code: "A2", signups: 1, shops: 0, publishedShops: 0, firstOfferings: 0, directoryListings: 1 },
    { code: AGENT_NONE, signups: 2, shops: 1, publishedShops: 0, firstOfferings: 0, directoryListings: 0 },
  ]);

  const empty = countAgentSignups([]);
  assert.deepEqual(empty, [
    { code: AGENT_NONE, signups: 0, shops: 0, publishedShops: 0, firstOfferings: 0, directoryListings: 0 },
  ]);
});

test("known agent codes default to A1–A4 and can be replaced from the environment", () => {
  assert.deepEqual(knownAgentCodes({}), ["A1", "A2", "A3", "A4"]);
  assert.deepEqual(knownAgentCodes({ FIELD_AGENT_CODES: "" }), ["A1", "A2", "A3", "A4"]);
  assert.deepEqual(knownAgentCodes({ FIELD_AGENT_CODES: "nope!, A5, a2, A5" }), ["A5", "A2"]);
  assert.deepEqual(knownAgentCodes({ FIELD_AGENT_CODES: "!!!" }), ["A1", "A2", "A3", "A4"]);
  assert.equal(agentCodeToStore(undefined, "A5", ["A5"]), "A5");
  assert.equal(agentCodeToStore(undefined, "A1", ["A5"]), null);
});

test("published shops are counted, unknown codes collapse to other, and dates filter sign-ups", () => {
  const known = ["A1", "A2", "A3", "A4"];
  const inWeek = new Date("2026-10-11T12:00:00.000Z");
  const before = new Date("2026-10-01T12:00:00.000Z");
  const rows = countAgentSignups(
    [
      { code: "A1", hasShop: true, hasPublishedShop: true, hasOffering: true, hasListing: false, at: inWeek },
      { code: "A1", hasShop: true, hasPublishedShop: false, hasOffering: false, hasListing: false, at: inWeek },
      { code: "B9", hasShop: true, hasPublishedShop: true, hasOffering: false, hasListing: true, at: inWeek },
      { code: "ZZ", hasShop: false, hasPublishedShop: false, hasOffering: false, hasListing: false, at: before },
      { code: null, hasShop: false, hasPublishedShop: false, hasOffering: false, hasListing: false, at: inWeek },
    ],
    {
      knownCodes: known,
      from: new Date("2026-10-10T21:00:00.000Z"),
      to: new Date("2026-10-11T21:00:00.000Z"),
    },
  );
  assert.deepEqual(
    rows.map((row) => row.code),
    ["A1", "A2", "A3", "A4", AGENT_OTHER, AGENT_NONE],
  );
  const a1 = rows.find((row) => row.code === "A1");
  assert.equal(a1?.signups, 2);
  assert.equal(a1?.shops, 2);
  assert.equal(a1?.publishedShops, 1);
  const other = rows.find((row) => row.code === AGENT_OTHER);
  assert.equal(other?.signups, 1);
  assert.equal(other?.publishedShops, 1);
  assert.equal(rows.find((row) => row.code === "A2")?.signups, 0);
  assert.equal(rows.find((row) => row.code === AGENT_NONE)?.signups, 1);
});

test("today, this week, and launch weekend use Nairobi dates", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const today = agentPresetRange("today", now);
  assert.equal(today.from.toISOString(), "2026-10-10T21:00:00.000Z");
  assert.equal(today.to.toISOString(), "2026-10-11T21:00:00.000Z");

  const week = agentPresetRange("week", now);
  assert.equal(week.from.toISOString(), "2026-10-04T21:00:00.000Z");
  assert.equal(week.to.toISOString(), "2026-10-11T21:00:00.000Z");

  const launch = agentPresetRange("launch", now);
  assert.equal(launch.from.toISOString(), "2026-10-16T21:00:00.000Z");
  assert.equal(launch.to.toISOString(), "2026-10-18T21:00:00.000Z");

  const named = resolveAgentRange({ agents: "launch" }, now);
  assert.equal(named.preset, "launch");
  assert.equal(named.label, "Launch weekend, 17–18 Oct");
  const custom = resolveAgentRange({ agents: "custom", from: "2026-10-17", to: "2026-10-18" }, now);
  assert.equal(custom.from?.toISOString(), launch.from.toISOString());
  assert.equal(custom.to?.toISOString(), launch.to.toISOString());
  assert.equal(resolveAgentRange({ agents: "nope" }, now).preset, "all");
});
