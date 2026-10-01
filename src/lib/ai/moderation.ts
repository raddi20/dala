import { after as runAfterResponse } from "next/server";
import { isCategory } from "@/lib/categories";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { isDebounced, MODERATION_DEBOUNCE_MS } from "@/lib/ai/limits";
import { photoFingerprint, photoHashSecret } from "@/lib/ai/photo-hash";
import { moderationPrompt, type ModerationResult } from "@/lib/ai/prompts/moderation";
import { downloadListingPhoto, isAllowedListingPhotoUrl, resizeListingPhoto } from "@/lib/ai/resize-photo";
import { runAi } from "@/lib/ai/run";
import type { AiActor, ImagePart, RunResult } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

export type ModerationFlag = ModerationResult["flags"][number];

export type ListingSnapshot = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  priceLabel: string;
  photoUrl: string;
  hidden: boolean;
  verified: boolean;
};

export type SuggestionRow = {
  listingId: string;
  userId: string;
  status: "open" | "clean";
  flagsJson: string;
  suggestedCategory: string;
  photoHash: string;
  duplicateIds: string;
  createdAt: Date;
};

export type ModerationStore = {
  listing(id: string): Promise<ListingSnapshot | null>;
  lastCheckedAt(listingId: string): Promise<Date | null>;
  duplicates(photoHash: string, listingId: string): Promise<string[]>;
  saveFingerprint(listingId: string, photoHash: string, createdAt: Date): Promise<void>;
  save(row: SuggestionRow): Promise<void>;
};

export type ModerationRunner = (
  spec: typeof moderationPrompt,
  input: { text: string; photo?: ImagePart | null },
  actor?: AiActor,
  deps?: { env?: NodeJS.ProcessEnv },
) => Promise<RunResult<ModerationResult>>;

export type SuggestResult = {
  status: "skipped" | "debounced" | "unavailable" | "clean" | "open";
};

export function dismissPatch(adminId: string, now: Date) {
  return { status: "dismissed" as const, dismissedAt: now, dismissedById: adminId };
}

export function readStoredFlags(json: string): ModerationFlag[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ModerationFlag => {
        if (!item || typeof item !== "object") return false;
        const flag = item as ModerationFlag;
        return typeof flag.kind === "string" && typeof flag.reason === "string";
      })
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function listingModerationText(listing: ListingSnapshot): string {
  return [`Title: ${listing.title}`, `Category: ${listing.category}`, `Price: ${listing.priceLabel}`, listing.description]
    .join("\n")
    .slice(0, 4000);
}

function openBecause(flags: ModerationFlag[], suggestedCategory: string, duplicateIds: string[]): boolean {
  return flags.length > 0 || Boolean(suggestedCategory) || duplicateIds.length > 0;
}

export function prismaModerationStore(): ModerationStore {
  return {
    async listing(id) {
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
          hidden: true,
          verified: true,
        },
      });
      return row;
    },
    async lastCheckedAt(listingId) {
      const row = await prisma.aiModerationSuggestion.findFirst({
        where: { listingId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return row?.createdAt ?? null;
    },
    async duplicates(photoHash, listingId) {
      const rows = await prisma.aiPhotoFingerprint.findMany({
        where: { photoHash, NOT: { listingId } },
        select: { listingId: true },
        take: 20,
      });
      return [...new Set(rows.map((row) => row.listingId).filter(Boolean))].slice(0, 5);
    },
    async saveFingerprint(listingId, photoHash, createdAt) {
      await prisma.aiPhotoFingerprint.create({ data: { listingId, photoHash, createdAt } });
    },
    async save(row) {
      await prisma.aiModerationSuggestion.create({ data: row });
    },
  };
}

export async function suggestListingModeration(
  listingId: string,
  deps: {
    now?: Date;
    env?: NodeJS.ProcessEnv;
    store?: ModerationStore;
    featureOn?: (feature: "moderation") => Promise<boolean>;
    run?: ModerationRunner;
    download?: (url: string) => Promise<Uint8Array>;
    resize?: (bytes: Uint8Array) => Promise<Uint8Array>;
  } = {},
): Promise<SuggestResult> {
  const store = deps.store ?? prismaModerationStore();
  const listing = await store.listing(listingId);
  if (!listing) return { status: "skipped" };

  const env = deps.env ?? process.env;
  const featureOn = deps.featureOn ?? ((feature) => isAiFeatureOn(feature, { env }));
  if (!(await featureOn("moderation"))) return { status: "skipped" };

  const now = deps.now ?? new Date();
  const last = await store.lastCheckedAt(listing.id);
  if (isDebounced(last ? last.getTime() : null, now.getTime(), MODERATION_DEBOUNCE_MS)) {
    return { status: "debounced" };
  }

  let photoHash = "";
  let duplicateIds: string[] = [];
  let photo: ImagePart | null = null;
  const secret = photoHashSecret(env);
  if (listing.photoUrl && isAllowedListingPhotoUrl(listing.photoUrl)) {
    try {
      const download = deps.download ?? downloadListingPhoto;
      const resize = deps.resize ?? resizeListingPhoto;
      const bytes = await download(listing.photoUrl);
      const hash = secret ? photoFingerprint(bytes, secret) : null;
      if (hash) {
        photoHash = hash;
        duplicateIds = await store.duplicates(hash, listing.id);
        await store.saveFingerprint(listing.id, hash, now);
      }
      const jpeg = await resize(bytes);
      photo = { mimeType: "image/jpeg", data: jpeg };
    } catch {
      photo = null;
    }
  }

  const run = deps.run ?? runAi;
  const result = await run(
    moderationPrompt,
    { text: listingModerationText(listing), photo },
    { userId: listing.ownerId },
    { env },
  );
  if (!result.ok) return { status: "unavailable" };

  const flags = result.data.flags.slice(0, 5);
  const suggested =
    result.data.suggestedCategory &&
    isCategory(result.data.suggestedCategory) &&
    result.data.suggestedCategory !== listing.category
      ? result.data.suggestedCategory
      : "";
  const status = openBecause(flags, suggested, duplicateIds) ? "open" : "clean";
  await store.save({
    listingId: listing.id,
    userId: listing.ownerId,
    status,
    flagsJson: JSON.stringify(flags),
    suggestedCategory: suggested,
    photoHash,
    duplicateIds: duplicateIds.join(","),
    createdAt: now,
  });
  return { status };
}

export function scheduleListingModeration(
  listingId: string,
  deps: {
    env?: NodeJS.ProcessEnv;
    after?: (task: () => Promise<void>) => void;
    suggest?: (id: string) => Promise<unknown>;
  } = {},
) {
  const env = deps.env ?? process.env;
  if (env.AI_MODERATION !== "1") return;
  const later = deps.after ?? runAfterResponse;
  try {
    later(() => (deps.suggest ?? suggestListingModeration)(listingId).then(() => undefined));
  } catch {
    // Publishing still succeeds when this runs outside a request.
  }
}
