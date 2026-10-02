import assert from "node:assert/strict";
import test from "node:test";
import { createListingDraft, type ListingDraftStore } from "@/lib/ai/listing-draft";
import { checkListingSuggestion, type ListingSuggestion } from "@/lib/ai/prompts/listing-writer";
import type { RunResult } from "@/lib/ai/types";

const suggestion: ListingSuggestion = {
  title: "Three-seat sofa",
  description: "A used three-seat sofa.",
  category: "Retail / shops",
  type: "for_sale",
  price: { amount: 25000, currency: "KES", label: "KES 25,000", fromInput: true },
  language: "en",
  confidence: "medium",
  warnings: [],
};

function store(user: { id: string } | null, consentAt: Date | null = null) {
  const drafts: unknown[] = [];
  const consents: string[] = [];
  const listings: unknown[] = [];
  const value: ListingDraftStore & { drafts: unknown[]; consents: string[]; listings: unknown[] } = {
    user,
    consentAt,
    drafts,
    consents,
    listings,
    async saveConsent(userId) {
      consents.push(userId);
      value.consentAt = new Date();
    },
    async saveDraft(row) {
      drafts.push(row);
    },
  };
  return value;
}

function okRun(data: ListingSuggestion = suggestion) {
  let calls = 0;
  const run = async () => {
    calls += 1;
    const result: RunResult<ListingSuggestion> = {
      ok: true,
      data,
      provider: "mock",
      model: "mock",
      costMicroUsd: 0,
      latencyMs: 1,
    };
    return result;
  };
  return { run, calls: () => calls };
}

test("a signed-out seller and a missing agreement do not call the model", async () => {
  const signedOut = okRun();
  const anonymous = await createListingDraft({ text: "sofa 25k", language: "en" }, { store: store(null), run: signedOut.run });
  assert.equal(anonymous.ok, false);
  if (!anonymous.ok) assert.equal(anonymous.status, 401);
  assert.equal(signedOut.calls(), 0);

  const needsConsent = okRun();
  const refused = await createListingDraft(
    { text: "sofa 25k", language: "en" },
    { store: store({ id: "seller" }), run: needsConsent.run },
  );
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.status, 403);
  assert.equal(needsConsent.calls(), 0);
});

test("agreement is stored once, the draft is saved, and no listing is published", async () => {
  const memory = store({ id: "seller" });
  const writer = okRun();
  const created = await createListingDraft(
    { text: "Used sofa, 25k", language: "en", consent: true },
    { store: memory, run: writer.run },
  );
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.suggestion.title, "Three-seat sofa");
    assert.equal(created.suggestion.priceLabel, "KES 25,000");
  }
  assert.deepEqual(memory.consents, ["seller"]);
  assert.equal(memory.drafts.length, 1);
  assert.equal(memory.listings.length, 0);
  assert.equal(writer.calls(), 1);

  const again = okRun();
  memory.consentAt = new Date();
  const repeat = await createListingDraft({ text: "Used sofa, 25k", language: "luo" }, { store: memory, run: again.run });
  assert.equal(repeat.ok, true);
  assert.equal(memory.consents.length, 1);
});

test("a long note, a foreign photo, a bad model result, and the rate cap are refused", async () => {
  const memory = store({ id: "seller" }, new Date());
  const tooLong = await createListingDraft({ text: "a".repeat(201), language: "en" }, { store: memory, run: okRun().run });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.status, 400);

  const foreign = await createListingDraft(
    { text: "sofa", language: "en", photoUrl: "https://evil.example/sofa.jpg" },
    { store: memory, run: okRun().run },
  );
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.status, 400);
  assert.equal(memory.drafts.length, 0);

  const invalid = await createListingDraft(
    { text: "sofa", language: "en" },
    { store: memory, run: async () => ({ ok: false, kind: "invalid_output" }) },
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.status, 503);
  assert.equal(memory.drafts.length, 0);

  const capped = await createListingDraft(
    { text: "sofa", language: "en" },
    { store: memory, run: async () => ({ ok: false, kind: "rate_capped" }) },
  );
  assert.equal(capped.ok, false);
  if (!capped.ok) assert.equal(capped.status, 429);

  const stripped = checkListingSuggestion(
    {
      ...suggestion,
      title: "Call 0712345678 now",
      price: { amount: 99999, currency: "KES", label: "KES 99,999", fromInput: true },
    },
    { text: "Used sofa, 25k", language: "en" },
  );
  assert.equal(stripped?.title.includes("0712"), false);
  assert.equal(stripped?.price.amount, null);
  assert.equal(stripped?.price.fromInput, false);
});
