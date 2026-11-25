import assert from "node:assert/strict";
import test from "node:test";
import { UPDATE_BLOCKLIST } from "@/lib/community/blocklist";
import {
  UPDATE_MONEY,
  UPDATE_POLITICS,
  UPDATE_SCAM,
  checkUpdateText,
  hasPhoneNumber,
  phraseHit,
} from "@/lib/community/text-guard";

test("a shop note can mention a price without a payment ask", () => {
  const ok = checkUpdateText("Omena is in. Tilapia is Ksh 200 this morning. Come by before noon.");
  assert.equal(ok.ok, true);
});

test("money asks, M-Pesa, and phone numbers are blocked", () => {
  assert.equal(checkUpdateText("Send the money on M-Pesa 0712 345 678").ok, false);
  assert.equal(hasPhoneNumber("Call +254712345678"), true);
  assert.equal(checkUpdateText("Paybill 400200").ok, false);
  const mpesa = checkUpdateText("Lipa na M-Pesa when you arrive");
  assert.equal(mpesa.ok, false);
  if (!mpesa.ok) assert.equal(mpesa.error, UPDATE_MONEY);
  const till = checkUpdateText("Use till number 123456");
  assert.equal(till.ok, false);
});

test("politics in English, Swahili, Sheng, and Dholuo is blocked", () => {
  const election = checkUpdateText("Come and vote for our shop this election");
  assert.equal(election.ok, false);
  if (!election.ok) assert.equal(election.error, UPDATE_POLITICS);
  assert.equal(checkUpdateText("Uchaguzi ni kesho").ok, false);
  assert.equal(checkUpdateText("Tuna kampeni ya samaki").ok, false);
  assert.equal(phraseHit("yiero", UPDATE_BLOCKLIST.politics.dholuo), "yiero");
  assert.equal(checkUpdateText("Fresh omena, no politics in the crate").ok, true);
});

test("obvious money schemes are blocked with a calm line", () => {
  const scam = checkUpdateText("Double your money if you wire transfer today");
  assert.equal(scam.ok, false);
  if (!scam.ok) assert.equal(scam.error, UPDATE_SCAM);
});

test("the blocklist is a config list you can extend", () => {
  assert.ok(UPDATE_BLOCKLIST.politics.en.includes("election"));
  assert.ok(UPDATE_BLOCKLIST.politics.sw.includes("uchaguzi"));
  assert.ok(UPDATE_BLOCKLIST.politics.sheng.includes("siasa"));
  assert.ok(Array.isArray(UPDATE_BLOCKLIST.politics.dholuo));
});
