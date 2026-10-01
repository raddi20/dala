import assert from "node:assert/strict";
import test from "node:test";
import { dismissPatch, scheduleListingModeration, suggestListingModeration, type ListingSnapshot, type ModerationStore, type SuggestionRow } from "@/lib/ai/moderation";
import type { ModerationResult } from "@/lib/ai/prompts/moderation";
import type { RunResult } from "@/lib/ai/types";

const listing: ListingSnapshot = Object.freeze({
  id: "listing_1",
  ownerId: "seller_1",
  title: "Sofa",
  description: "A used sofa. Pay first.",
  category: "Retail / shops",
  priceLabel: "KES 25,000",
  photoUrl: "https://store.public.blob.vercel-storage.com/sofa.jpg",
  hidden: false,
  verified: false,
});

const flag: ModerationResult["flags"][number] = {
  kind: "scam_text",
  severity: "high",
  reason: "Asks for payment first",
  evidence: "Pay first",
};

function memory(
  source: ListingSnapshot | null,
  extras?: { last?: Date | null; known?: { listingId: string; photoHash: string }[] },
) {
  const saved: SuggestionRow[] = [];
  const fingerprints: string[] = [];
  const store: ModerationStore = {
    async listing() {
      return source;
    },
    async lastCheckedAt() {
      return extras?.last ?? null;
    },
    async knownFingerprints() {
      return extras?.known ?? [];
    },
    async saveFingerprint(_listingId, photoHash) {
      fingerprints.push(photoHash);
    },
    async save(row) {
      saved.push(row);
    },
  };
  return { store, saved, fingerprints };
}

function runWith(data: ModerationResult) {
  let calls = 0;
  const run = async () => {
    calls += 1;
    const result: RunResult<ModerationResult> = {
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

const clean: ModerationResult = { flags: [], suggestedCategory: null };
const env = { MOD_PHOTO_HASH: "1", AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv;

test("a switched-off check does not call the model or write a suggestion", async () => {
  const box = memory(listing);
  const writer = runWith({ flags: [flag], suggestedCategory: null });
  let downloads = 0;
  const result = await suggestListingModeration(listing.id, {
    store: box.store,
    run: writer.run,
    featureOn: async () => false,
    download: async () => {
      downloads += 1;
      return new Uint8Array([1, 2, 3]);
    },
  });
  assert.equal(result.status, "skipped");
  assert.equal(writer.calls(), 0);
  assert.equal(downloads, 0);
  assert.equal(box.saved.length, 0);
  assert.equal(listing.hidden, false);
  assert.equal(listing.verified, false);
});

test("no model key leaves the listing untouched", async () => {
  const box = memory(listing);
  const result = await suggestListingModeration(listing.id, {
    store: box.store,
    featureOn: async () => true,
    env,
    run: async () => ({ ok: false, kind: "disabled" }),
    download: async () => new Uint8Array([9, 9, 9]),
    resize: async (bytes) => bytes,
  });
  assert.equal(result.status, "unavailable");
  assert.equal(box.saved.length, 0);
  assert.equal(listing.hidden, false);
  assert.equal(listing.verified, false);
});

test("a suggestion is queued and never hides, rejects, or verifies the listing", async () => {
  const box = memory(listing, { known: [{ listingId: "listing_older", photoHash: "0000000000000001" }] });
  const writer = runWith({ flags: [flag], suggestedCategory: "Food & restaurants" });
  const result = await suggestListingModeration(listing.id, {
    now: new Date("2026-10-01T12:00:00Z"),
    env,
    store: box.store,
    featureOn: async () => true,
    run: writer.run,
    download: async () => new Uint8Array([4, 5, 6, 7]),
    resize: async (bytes) => bytes,
    fingerprint: async () => "0000000000000000",
  });
  assert.equal(result.status, "open");
  assert.equal(box.saved.length, 1);
  assert.equal(box.saved[0]?.status, "open");
  assert.equal(box.saved[0]?.suggestedCategory, "Food & restaurants");
  assert.equal(box.saved[0]?.duplicateIds, "listing_older");
  assert.equal(box.fingerprints.length, 1);
  assert.equal(box.fingerprints[0], "0000000000000000");
  assert.equal(JSON.stringify(box.saved[0]).includes("hidden"), false);
  assert.equal(listing.hidden, false);
  assert.equal(listing.verified, false);
  assert.equal(writer.calls(), 1);

  const patch = dismissPatch("admin_1", new Date("2026-10-01T13:00:00Z"));
  assert.deepEqual(Object.keys(patch).sort(), ["dismissedAt", "dismissedById", "status"]);
  assert.equal(patch.status, "dismissed");
});

test("fingerprints run without the model and a one-bit difference still matches", async () => {
  const box = memory(listing, { known: [{ listingId: "listing_older", photoHash: "0000000000000001" }] });
  const writer = runWith(clean);
  const result = await suggestListingModeration(listing.id, {
    env: { MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv,
    store: box.store,
    featureOn: async () => false,
    run: writer.run,
    download: async () => new Uint8Array([8]),
    fingerprint: async () => "0000000000000000",
  });
  assert.equal(result.status, "open");
  assert.equal(writer.calls(), 0);
  assert.equal(box.saved[0]?.duplicateIds, "listing_older");
  assert.equal(box.saved[0]?.flagsJson, "[]");
  assert.equal(listing.hidden, false);
});

test("the same photo is noted even when the model finds nothing, and a recent check is skipped", async () => {
  const box = memory({ ...listing, photoUrl: "" });
  const writer = runWith(clean);
  const textOnly = await suggestListingModeration(listing.id, {
    env: { AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv,
    store: box.store,
    featureOn: async () => true,
    run: writer.run,
  });
  assert.equal(textOnly.status, "clean");
  assert.equal(box.fingerprints.length, 0);
  assert.equal(box.saved[0]?.status, "clean");

  const again = memory(listing, { last: new Date("2026-10-01T12:05:00Z") });
  const skipped = await suggestListingModeration(listing.id, {
    now: new Date("2026-10-01T12:10:00Z"),
    store: again.store,
    featureOn: async () => true,
    run: writer.run,
  });
  assert.equal(skipped.status, "debounced");
  assert.equal(writer.calls(), 1);
});

test("scheduling stays idle unless moderation or photo fingerprints are on", async () => {
  const tasks: Array<() => Promise<void>> = [];
  scheduleListingModeration(listing.id, {
    env: { AI_MODERATION: "", MOD_PHOTO_HASH: "" } as unknown as NodeJS.ProcessEnv,
    after() {
      throw new Error("should not schedule");
    },
  });
  let ran = false;
  scheduleListingModeration(listing.id, {
    env: { AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv,
    after(task) {
      tasks.push(task);
    },
    suggest: async () => {
      ran = true;
    },
  });
  assert.equal(tasks.length, 1);
  await tasks[0]?.();
  assert.equal(ran, true);
});
