import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryMedian,
  isPriceOutlier,
  parsePriceAmount,
  runModeration,
  scheduleListingModeration,
  unhashedPhotoTargets,
  type FlagDraft,
  type HashDraft,
  type ListingSnapshot,
} from "@/lib/ai/moderation";
import type { HashCandidate } from "@/lib/ai/photo-hash";
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
  scamFired: true,
});

const flag: ModerationResult["flags"][number] = {
  kind: "scam_text",
  severity: "high",
  reason: "Asks for payment first",
  evidence: "Pay first",
};

function harness(source: ListingSnapshot | null, hashes: HashCandidate[] = []) {
  const saved: FlagDraft[] = [];
  const fingerprints: HashDraft[] = [];
  return {
    saved,
    fingerprints,
    base: {
      listing: source,
      hashes,
      categoryPrices: [] as number[],
      lastAiAt: null as Date | null,
      saveFlag: async (row: FlagDraft) => {
        saved.push(row);
      },
      saveHash: async (row: HashDraft) => {
        fingerprints.push(row);
      },
      download: async () => new Uint8Array([4, 5, 6]),
      resize: async (bytes: Uint8Array) => bytes,
      fingerprint: async () => "0000000000000000",
    },
  };
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

const env = { MOD_PHOTO_HASH: "1", AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv;

test("a price far from the category median is an outlier only when eight prices exist", () => {
  assert.equal(parsePriceAmount("KES 25,000"), 25000);
  assert.equal(parsePriceAmount("500"), 500);
  const few = [100, 200, 300, 400, 500, 600, 700];
  assert.equal(categoryMedian(few), null);
  const usual = [40000, 42000, 45000, 48000, 50000, 52000, 55000, 60000];
  assert.equal(isPriceOutlier(500, usual), true);
  assert.equal(isPriceOutlier(50000, usual), false);
});

test("a switched-off check does not call the model or write a flag", async () => {
  const box = harness(listing);
  const writer = runWith({ flags: [flag], suggestedCategory: null });
  const result = await runModeration(
    { targetType: "listing", targetId: listing.id },
    { ...box.base, run: writer.run, featureOn: async () => false, env: {} as NodeJS.ProcessEnv },
  );
  assert.equal(result.status, "skipped");
  assert.equal(writer.calls(), 0);
  assert.equal(box.saved.length, 0);
});

test("another seller's photo is flagged and the same seller's photo is not", async () => {
  const other = harness(listing, [
    { ownerType: "listing", ownerId: "listing_older", ownerUser: "seller_2", dhash: "0000000000000001" },
  ]);
  const writer = runWith({ flags: [], suggestedCategory: null });
  const flagged = await runModeration(
    { targetType: "listing", targetId: listing.id },
    { ...other.base, env, featureOn: async () => true, run: writer.run },
  );
  assert.equal(flagged.status, "open");
  assert.equal(other.saved.some((row) => row.kind === "duplicate_photo" && row.source === "phash"), true);
  assert.equal(other.fingerprints[0]?.h3, "0000");

  const own = harness(listing, [
    { ownerType: "listing", ownerId: "listing_mine", ownerUser: "seller_1", dhash: "0000000000000001" },
  ]);
  const quiet = await runModeration(
    { targetType: "listing", targetId: listing.id },
    { ...own.base, env: { MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv, featureOn: async () => false },
  );
  assert.equal(quiet.flags, 0);
  assert.equal(own.saved.some((row) => row.kind === "duplicate_photo"), false);
  assert.equal(own.fingerprints.length, 1);
});

test("a low-severity note is kept only when the scam rules also fired", async () => {
  const low = { kind: "misleading" as const, severity: "low" as const, reason: "Vague", evidence: "sofa" };
  const fired = harness(listing);
  await runModeration(
    { targetType: "listing", targetId: listing.id },
    {
      ...fired.base,
      env: { AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv,
      featureOn: async () => true,
      fingerprint: async () => null,
      run: runWith({ flags: [low], suggestedCategory: null }).run,
    },
  );
  assert.equal(fired.saved.some((row) => row.kind === "misleading" && row.status === "open"), true);

  const calm = harness({ ...listing, description: "A used sofa.", scamFired: false, photoUrl: "" });
  await runModeration(
    { targetType: "listing", targetId: listing.id },
    {
      ...calm.base,
      env: { AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv,
      featureOn: async () => true,
      run: runWith({ flags: [low], suggestedCategory: null }).run,
    },
  );
  assert.equal(calm.saved.some((row) => row.status === "open"), false);
  assert.equal(calm.saved.some((row) => row.source === "ai" && row.status === "dismissed"), true);
});

test("a recent model check is not repeated", async () => {
  const box = harness({ ...listing, photoUrl: "" });
  const writer = runWith({ flags: [], suggestedCategory: null });
  const skipped = await runModeration(
    { targetType: "listing", targetId: listing.id },
    {
      ...box.base,
      now: new Date("2026-10-01T12:10:00Z"),
      lastAiAt: new Date("2026-10-01T12:05:00Z"),
      env: { AI_MODERATION: "1" } as unknown as NodeJS.ProcessEnv,
      featureOn: async () => true,
      run: writer.run,
    },
  );
  assert.equal(skipped.status, "debounced");
  assert.equal(writer.calls(), 0);
});

test("an iPhone priced at 500 is a price outlier when the category has enough sales", async () => {
  const phone: ListingSnapshot = {
    ...listing,
    title: "iPhone 16",
    description: "Phone",
    category: "Electronics",
    priceLabel: "KES 500",
    photoUrl: "",
    scamFired: false,
  };
  const box = harness(phone);
  const usual = [40000, 42000, 45000, 48000, 50000, 52000, 55000, 60000];
  const result = await runModeration(
    { targetType: "listing", targetId: phone.id },
    {
      ...box.base,
      categoryPrices: usual,
      env: { MOD_PHOTO_HASH: "1" } as unknown as NodeJS.ProcessEnv,
      featureOn: async () => false,
    },
  );
  assert.equal(result.status, "open");
  assert.equal(box.saved.some((row) => row.kind === "price_outlier" && row.source === "stats"), true);
});

test("the backfill takes at most 200 photos that have no fingerprint yet", () => {
  const existing = new Set(["listing:done"]);
  const rows = [
    { ownerType: "listing", ownerId: "done", url: "https://example.com/a.jpg" },
    { ownerType: "listing", ownerId: "new", url: "https://example.com/b.jpg" },
    { ownerType: "offering", ownerId: "blank", url: "  " },
  ];
  assert.deepEqual(unhashedPhotoTargets(existing, rows, 200), [
    { ownerType: "listing", ownerId: "new", url: "https://example.com/b.jpg" },
  ]);
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
