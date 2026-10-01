import { after as runAfterResponse } from "next/server";
import { isCategory } from "@/lib/categories";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { isDebounced, MODERATION_DEBOUNCE_MS } from "@/lib/ai/limits";
import { dHash, hashChunks, otherOwnerMatches, photoHashEnabled, type HashCandidate } from "@/lib/ai/photo-hash";
import { moderationPrompt, type ModerationResult } from "@/lib/ai/prompts/moderation";
import { downloadListingPhoto, isAllowedListingPhotoUrl, resizeListingPhoto } from "@/lib/ai/resize-photo";
import { runAi } from "@/lib/ai/run";
import type { AiActor, ImagePart, RunResult } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

export const SWEEP_BATCH = 200;

export type ListingSnapshot = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  priceLabel: string;
  photoUrl: string;
  scamFired: boolean;
};

export type FlagDraft = {
  targetType: string;
  targetId: string;
  source: string;
  kind: string;
  severity: string;
  reason: string;
  evidenceJson: string;
  status: "open" | "dismissed" | "actioned";
  createdAt: Date;
  resolvedAt?: Date | null;
};

export type HashDraft = HashCandidate & {
  mediaType: string;
  url: string;
  h0: string;
  h1: string;
  h2: string;
  h3: string;
  createdAt: Date;
};

export type ModerationRunner = (
  spec: typeof moderationPrompt,
  input: { text: string; photo?: ImagePart | null },
  actor?: AiActor,
  deps?: { env?: NodeJS.ProcessEnv },
) => Promise<RunResult<ModerationResult>>;

export type ModerationTarget = { targetType: "listing" | "offering" | "storefront"; targetId: string };

export type RunModerationResult = { status: "skipped" | "debounced" | "unavailable" | "clean" | "open"; flags: number };

export function parsePriceAmount(label: string): number | null {
  const match = label.replace(/,/g, "").match(/(\d+(?:\.\d+)?)(\s*[kK])?/);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return match[2] ? Math.round(value * 1000) : Math.round(value);
}

export function categoryMedian(amounts: number[]): number | null {
  if (amounts.length < 8) return null;
  const sorted = [...amounts].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) return null;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1];
  if (lower === undefined) return null;
  return (lower + upper) / 2;
}

export function isPriceOutlier(amount: number, amounts: number[]): boolean {
  const mid = categoryMedian(amounts);
  if (mid === null || mid <= 0) return false;
  return amount < mid * 0.25 || amount > mid * 4;
}

export function listingModerationText(listing: ListingSnapshot): string {
  return [`Title: ${listing.title}`, `Category: ${listing.category}`, `Price: ${listing.priceLabel}`, listing.description]
    .join("\n")
    .slice(0, 4000);
}

export function unhashedPhotoTargets(
  existingKeys: Set<string>,
  rows: { ownerType: string; ownerId: string; url: string }[],
  limit = SWEEP_BATCH,
): { ownerType: string; ownerId: string; url: string }[] {
  const out: { ownerType: string; ownerId: string; url: string }[] = [];
  for (const row of rows) {
    if (!row.url.trim()) continue;
    const key = `${row.ownerType}:${row.ownerId}`;
    if (existingKeys.has(key)) continue;
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function openFlag(partial: Omit<FlagDraft, "status" | "createdAt">, now: Date): FlagDraft {
  return { ...partial, status: "open", createdAt: now };
}

export async function runModeration(
  target: ModerationTarget,
  deps: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
    featureOn?: (feature: "moderation") => Promise<boolean>;
    listing?: ListingSnapshot | null;
    hashes?: HashCandidate[];
    categoryPrices?: number[];
    lastAiAt?: Date | null;
    run?: ModerationRunner;
    download?: (url: string) => Promise<Uint8Array>;
    resize?: (bytes: Uint8Array) => Promise<Uint8Array>;
    fingerprint?: (bytes: Uint8Array) => Promise<string | null>;
    hashOnly?: boolean;
    saveHash?: (row: HashDraft) => Promise<void>;
    saveFlag?: (row: FlagDraft) => Promise<void>;
    loadListing?: (id: string) => Promise<ListingSnapshot | null>;
    loadHashes?: (chunks: { h0: string; h1: string; h2: string; h3: string }) => Promise<HashCandidate[]>;
    loadPrices?: (category: string, listingId: string) => Promise<number[]>;
    loadLastAiAt?: (targetId: string) => Promise<Date | null>;
  } = {},
): Promise<RunModerationResult> {
  const env = deps.env ?? process.env;
  const featureOn = deps.featureOn ?? ((feature) => isAiFeatureOn(feature, { env }));
  const aiOn = await featureOn("moderation");
  const hashOn = photoHashEnabled(env);
  if (!aiOn && !hashOn) return { status: "skipped", flags: 0 };

  const now = deps.now ?? new Date();
  if (target.targetType !== "listing") {
    if (!hashOn) return { status: "skipped", flags: 0 };
    const hashed = await fingerprintOwnedPhoto(target, { now, env, download: deps.download, fingerprint: deps.fingerprint, saveHash: deps.saveHash, saveFlag: deps.saveFlag });
    return { status: hashed > 0 ? "open" : "clean", flags: hashed };
  }

  const listing = deps.listing !== undefined ? deps.listing : await (deps.loadListing ?? loadListing)(target.targetId);
  if (!listing) return { status: "skipped", flags: 0 };

  const saveFlag = deps.saveFlag ?? saveFlagRow;
  if (deps.hashOnly) {
    if (!hashOn || !listing.photoUrl || !isAllowedListingPhotoUrl(listing.photoUrl)) return { status: "clean", flags: 0 };
    const duplicate = await rememberPhoto({
      now,
      url: listing.photoUrl,
      mediaType: "photo",
      ownerType: "listing",
      ownerId: listing.id,
      ownerUser: listing.ownerId,
      targetType: "listing",
      download: deps.download,
      fingerprint: deps.fingerprint,
      hashes: deps.hashes,
      loadHashes: deps.loadHashes,
      saveHash: deps.saveHash,
    });
    if (duplicate) await saveFlag(duplicate);
    return { status: duplicate ? "open" : "clean", flags: duplicate ? 1 : 0 };
  }
  const flags: FlagDraft[] = [];

  if (hashOn && listing.photoUrl && isAllowedListingPhotoUrl(listing.photoUrl)) {
    const duplicate = await rememberPhoto({
      now,
      url: listing.photoUrl,
      mediaType: "photo",
      ownerType: "listing",
      ownerId: listing.id,
      ownerUser: listing.ownerId,
      targetType: "listing",
      download: deps.download,
      fingerprint: deps.fingerprint,
      hashes: deps.hashes,
      loadHashes: deps.loadHashes,
      saveHash: deps.saveHash,
    });
    if (duplicate) flags.push(duplicate);
  }

  const prices = deps.categoryPrices ?? (await (deps.loadPrices ?? loadCategoryPrices)(listing.category, listing.id));
  const amount = parsePriceAmount(listing.priceLabel);
  if (amount !== null && isPriceOutlier(amount, prices)) {
    flags.push(
      openFlag(
        {
          targetType: "listing",
          targetId: listing.id,
          source: "stats",
          kind: "price_outlier",
          severity: "medium",
          reason: "The price is far from the usual price in this category.",
          evidenceJson: JSON.stringify({ amount, sample: prices.length }),
        },
        now,
      ),
    );
  }

  const lastAiAt = deps.lastAiAt !== undefined ? deps.lastAiAt : await (deps.loadLastAiAt ?? loadLastAiAt)(listing.id);
  const debounced = isDebounced(lastAiAt ? lastAiAt.getTime() : null, now.getTime(), MODERATION_DEBOUNCE_MS);

  if (aiOn && !debounced) {
    let photo: ImagePart | null = null;
    if (listing.photoUrl && isAllowedListingPhotoUrl(listing.photoUrl)) {
      try {
        const download = deps.download ?? downloadListingPhoto;
        const resize = deps.resize ?? resizeListingPhoto;
        photo = { mimeType: "image/jpeg", data: await resize(await download(listing.photoUrl)) };
      } catch {
        photo = null;
      }
    }
    const run = deps.run ?? runAi;
    const result = await run(moderationPrompt, { text: listingModerationText(listing), photo }, { userId: listing.ownerId }, { env });
    if (!result.ok) {
      for (const flag of flags) await saveFlag(flag);
      return { status: flags.length > 0 ? "open" : "unavailable", flags: flags.length };
    }
    const kept = result.data.flags
      .filter((flag) => flag.severity !== "low" || listing.scamFired)
      .slice(0, 5);
    for (const flag of kept) {
      flags.push(
        openFlag(
          {
            targetType: "listing",
            targetId: listing.id,
            source: "ai",
            kind: flag.kind,
            severity: flag.severity,
            reason: flag.reason.slice(0, 200),
            evidenceJson: JSON.stringify({ evidence: flag.evidence.slice(0, 200) }),
          },
          now,
        ),
      );
    }
    const suggested = result.data.suggestedCategory;
    if (
      suggested &&
      isCategory(suggested) &&
      suggested !== listing.category &&
      !flags.some((flag) => flag.kind === "off_category") &&
      kept.length < 5
    ) {
      flags.push(
        openFlag(
          {
            targetType: "listing",
            targetId: listing.id,
            source: "ai",
            kind: "off_category",
            severity: "medium",
            reason: `Suggested category: ${suggested}`,
            evidenceJson: JSON.stringify({ suggestedCategory: suggested }),
          },
          now,
        ),
      );
    }
    if (!flags.some((flag) => flag.source === "ai")) {
      flags.push({
        targetType: "listing",
        targetId: listing.id,
        source: "ai",
        kind: "other",
        severity: "low",
        reason: "",
        evidenceJson: "{}",
        status: "dismissed",
        createdAt: now,
        resolvedAt: now,
      });
    }
  }

  const open = flags.filter((flag) => flag.status === "open");
  for (const flag of flags) await saveFlag(flag);
  if (!aiOn || debounced) return { status: open.length > 0 ? "open" : debounced ? "debounced" : "clean", flags: open.length };
  return { status: open.length > 0 ? "open" : "clean", flags: open.length };
}

async function rememberPhoto(input: {
  now: Date;
  url: string;
  mediaType: string;
  ownerType: string;
  ownerId: string;
  ownerUser: string;
  targetType: string;
  download?: (url: string) => Promise<Uint8Array>;
  fingerprint?: (bytes: Uint8Array) => Promise<string | null>;
  hashes?: HashCandidate[];
  loadHashes?: (chunks: { h0: string; h1: string; h2: string; h3: string }) => Promise<HashCandidate[]>;
  saveHash?: (row: HashDraft) => Promise<void>;
}): Promise<FlagDraft | null> {
  try {
    const download = input.download ?? downloadListingPhoto;
    const bytes = await download(input.url);
    const dhash = await (input.fingerprint ?? dHash)(bytes);
    const chunks = dhash ? hashChunks(dhash) : null;
    if (!dhash || !chunks) return null;
    const known = input.hashes ?? (await (input.loadHashes ?? loadHashCandidates)(chunks));
    const matches = otherOwnerMatches(dhash, input.ownerUser, known).filter(
      (row) => !(row.ownerType === input.ownerType && row.ownerId === input.ownerId),
    );
    await (input.saveHash ?? saveHashRow)({
      ...chunks,
      mediaType: input.mediaType,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      ownerUser: input.ownerUser,
      url: input.url,
      dhash: dhash.toLowerCase(),
      createdAt: input.now,
    });
    if (matches.length === 0) return null;
    return openFlag(
      {
        targetType: input.targetType,
        targetId: input.ownerId,
        source: "phash",
        kind: "duplicate_photo",
        severity: "medium",
        reason: "Similar photo to another seller.",
        evidenceJson: JSON.stringify({
          matches: matches.map((row) => ({ ownerType: row.ownerType, ownerId: row.ownerId, ownerUser: row.ownerUser })),
        }),
      },
      input.now,
    );
  } catch {
    return null;
  }
}

async function fingerprintOwnedPhoto(
  target: ModerationTarget,
  deps: {
    now: Date;
    env: NodeJS.ProcessEnv;
    download?: (url: string) => Promise<Uint8Array>;
    fingerprint?: (bytes: Uint8Array) => Promise<string | null>;
    saveHash?: (row: HashDraft) => Promise<void>;
    saveFlag?: (row: FlagDraft) => Promise<void>;
  },
): Promise<number> {
  const photo = await loadOwnedPhoto(target);
  if (!photo || !isAllowedListingPhotoUrl(photo.url)) return 0;
  const flag = await rememberPhoto({
    now: deps.now,
    url: photo.url,
    mediaType: "photo",
    ownerType: photo.ownerType,
    ownerId: target.targetId,
    ownerUser: photo.ownerUser,
    targetType: target.targetType,
    download: deps.download,
    fingerprint: deps.fingerprint,
    saveHash: deps.saveHash,
  });
  if (!flag) return 0;
  await (deps.saveFlag ?? saveFlagRow)(flag);
  return 1;
}

export function scheduleModeration(
  target: ModerationTarget,
  deps: {
    env?: NodeJS.ProcessEnv;
    after?: (task: () => Promise<void>) => void;
    run?: (target: ModerationTarget) => Promise<unknown>;
  } = {},
) {
  const env = deps.env ?? process.env;
  if (env.AI_MODERATION !== "1" && env.MOD_PHOTO_HASH !== "1") return;
  const later = deps.after ?? runAfterResponse;
  try {
    later(() => (deps.run ?? runModeration)(target).then(() => undefined));
  } catch {
    // Saving still succeeds when this runs outside a request.
  }
}

export function scheduleListingModeration(
  listingId: string,
  deps: {
    env?: NodeJS.ProcessEnv;
    after?: (task: () => Promise<void>) => void;
    suggest?: (id: string) => Promise<unknown>;
  } = {},
) {
  scheduleModeration(
    { targetType: "listing", targetId: listingId },
    {
      env: deps.env,
      after: deps.after,
      run: deps.suggest ? () => deps.suggest?.(listingId) ?? Promise.resolve() : undefined,
    },
  );
}

async function loadListing(id: string): Promise<ListingSnapshot | null> {
  const row = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      category: true,
      priceLabel: true,
      photoUrl: true,
      scamRisk: true,
    },
  });
  if (!row) return null;
  return { ...row, scamFired: row.scamRisk !== "low" };
}

async function loadOwnedPhoto(target: ModerationTarget): Promise<{ url: string; ownerUser: string; ownerType: string } | null> {
  if (target.targetType === "offering") {
    const row = await prisma.offering.findUnique({
      where: { id: target.targetId },
      select: { imageUrl: true, storefront: { select: { userId: true } } },
    });
    if (!row?.storefront) return null;
    return { url: row.imageUrl, ownerUser: row.storefront.userId, ownerType: "offering" };
  }
  const row = await prisma.storefront.findUnique({
    where: { id: target.targetId },
    select: { bannerUrl: true, userId: true },
  });
  if (!row) return null;
  return { url: row.bannerUrl, ownerUser: row.userId, ownerType: "storefront_banner" };
}

async function loadHashCandidates(chunks: { h0: string; h1: string; h2: string; h3: string }): Promise<HashCandidate[]> {
  return prisma.mediaHash.findMany({
    where: { OR: [{ h0: chunks.h0 }, { h1: chunks.h1 }, { h2: chunks.h2 }, { h3: chunks.h3 }] },
    take: 200,
    select: { ownerType: true, ownerId: true, ownerUser: true, dhash: true },
  });
}

async function loadCategoryPrices(category: string, listingId: string): Promise<number[]> {
  const rows = await prisma.listing.findMany({
    where: { category, id: { not: listingId } },
    select: { priceLabel: true },
    take: 400,
  });
  return rows.flatMap((row) => {
    const amount = parsePriceAmount(row.priceLabel);
    return amount === null ? [] : [amount];
  });
}

async function loadLastAiAt(targetId: string): Promise<Date | null> {
  const row = await prisma.moderationFlag.findFirst({
    where: { targetType: "listing", targetId, source: "ai" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

async function saveFlagRow(row: FlagDraft): Promise<void> {
  await prisma.moderationFlag.create({ data: row });
}

async function saveHashRow(row: HashDraft): Promise<void> {
  await prisma.mediaHash.create({ data: row });
}

export async function reviewModerationFlag(input: {
  flagId: string;
  action: "dismiss" | "actioned";
  note: string;
  adminId: string;
  adminEmail: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const status = input.action === "dismiss" ? "dismissed" : "actioned";
  const updated = await prisma.moderationFlag.updateMany({
    where: { id: input.flagId, status: "open" },
    data: { status, resolvedAt: now },
  });
  if (updated.count === 0) return;
  await prisma.moderationReview.create({
    data: {
      flagId: input.flagId,
      action: input.action,
      note: input.note.slice(0, 500),
      adminId: input.adminId,
      adminEmail: input.adminEmail,
      createdAt: now,
    },
  });
}
