import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runAi } from "@/lib/ai/run";
import { listingWriterPrompt, type ListingSuggestion, type ListingWriterInput } from "@/lib/ai/prompts/listing-writer";
import type { AiActor, RunResult } from "@/lib/ai/types";
import { downloadListingPhoto, isAllowedListingPhotoUrl, resizeListingPhoto } from "@/lib/ai/resize-photo";

export const listingDraftBody = z.object({
  text: z.string().trim().min(1).max(200),
  language: z.enum(["en", "luo"]).default("en"),
  photoUrl: z.string().trim().max(500).optional().default(""),
  consent: z.boolean().optional().default(false),
});

export type ListingDraftBody = z.infer<typeof listingDraftBody>;

export type ListingDraftResponse = {
  title: string;
  description: string;
  category: string;
  type: string;
  priceLabel: string;
  warnings: string[];
};

export type DraftFailure = { ok: false; status: number; error: string };
export type DraftSuccess = { ok: true; suggestion: ListingDraftResponse };
export type DraftResult = DraftSuccess | DraftFailure;

export type ListingDraftStore = {
  user: { id: string } | null;
  consentAt: Date | null;
  saveConsent(userId: string, at: Date, language?: string): Promise<void>;
  saveDraft(row: {
    userId: string;
    inputText: string;
    language: string;
    photoUrl: string;
    suggestionJson: string;
    createdAt: Date;
  }): Promise<void>;
};

export type DraftRunner = (
  spec: typeof listingWriterPrompt,
  input: ListingWriterInput,
  actor?: AiActor,
  deps?: { env?: NodeJS.ProcessEnv },
) => Promise<RunResult<ListingSuggestion>>;

const UNAVAILABLE = "Not available right now. You can still fill the form yourself.";

export function priceLabelFromSuggestion(price: ListingSuggestion["price"]): string {
  if (!price.fromInput || price.amount === null || !price.label) return "";
  return price.label.slice(0, 40);
}

export function toDraftResponse(suggestion: ListingSuggestion): ListingDraftResponse {
  return {
    title: suggestion.title,
    description: suggestion.description,
    category: suggestion.category,
    type: suggestion.type,
    priceLabel: priceLabelFromSuggestion(suggestion.price),
    warnings: suggestion.warnings,
  };
}

export function prismaListingDraftStore(): ListingDraftStore {
  return {
    user: null,
    consentAt: null,
    async saveConsent(userId, at, language = "en") {
      await prisma.sellerAiPrefs.upsert({
        where: { userId },
        create: { userId, aiConsentAt: at, language },
        update: { aiConsentAt: at, language },
      });
    },
    async saveDraft(row) {
      await prisma.aiListingDraft.create({ data: row });
      await prisma.sellerAiPrefs.updateMany({
        where: { userId: row.userId },
        data: { language: row.language },
      });
    },
  };
}

export async function loadListingDraftStore(user: { id: string } | null): Promise<ListingDraftStore> {
  const store = prismaListingDraftStore();
  if (!user) return { ...store, user: null, consentAt: null };
  let consentAt: Date | null = null;
  try {
    const prefs = await prisma.sellerAiPrefs.findUnique({ where: { userId: user.id }, select: { aiConsentAt: true } });
    consentAt = prefs?.aiConsentAt ?? null;
  } catch {
    consentAt = null;
  }
  return { ...store, user, consentAt };
}

export async function createListingDraft(
  raw: unknown,
  deps: {
    store: ListingDraftStore;
    now?: Date;
    env?: NodeJS.ProcessEnv;
    run?: DraftRunner;
    download?: (url: string) => Promise<Uint8Array>;
    resize?: (bytes: Uint8Array) => Promise<Uint8Array>;
  },
): Promise<DraftResult> {
  if (!deps.store.user) return { ok: false, status: 401, error: "Sign in to draft a listing." };
  const parsed = listingDraftBody.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: "Describe the listing in 200 characters or fewer." };

  const body = parsed.data;
  const photoUrl = body.photoUrl.trim();
  if (photoUrl && !isAllowedListingPhotoUrl(photoUrl)) {
    return { ok: false, status: 400, error: "The photo must already be uploaded on this site." };
  }
  if (!deps.store.consentAt && !body.consent) {
    return { ok: false, status: 403, error: "Agree to send this text and photo to the draft service first." };
  }

  const now = deps.now ?? new Date();
  const userId = deps.store.user.id;
  if (!deps.store.consentAt) {
    try {
      await deps.store.saveConsent(userId, now, body.language);
    } catch {
      return { ok: false, status: 503, error: UNAVAILABLE };
    }
  }

  let photo: { mimeType: "image/jpeg"; data: Uint8Array } | null = null;
  if (photoUrl) {
    try {
      const download = deps.download ?? downloadListingPhoto;
      const resize = deps.resize ?? resizeListingPhoto;
      const bytes = await resize(await download(photoUrl));
      photo = { mimeType: "image/jpeg", data: bytes };
    } catch {
      return { ok: false, status: 400, error: "Could not read that photo. Try again without it." };
    }
  }

  const run = deps.run ?? runAi;
  const result = await run(
    listingWriterPrompt,
    { text: body.text, language: body.language, photo },
    { userId },
    deps.env ? { env: deps.env } : {},
  );
  if (!result.ok) {
    if (result.kind === "rate_capped") {
      return { ok: false, status: 429, error: "You have used today's drafts. Fill the form yourself, or try again later." };
    }
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  const suggestion = toDraftResponse(result.data);
  if (suggestion.category && !suggestion.title) return { ok: false, status: 503, error: UNAVAILABLE };
  try {
    await deps.store.saveDraft({
      userId,
      inputText: body.text,
      language: body.language,
      photoUrl,
      suggestionJson: JSON.stringify(suggestion),
      createdAt: now,
    });
  } catch {
    // The seller can still review the text. A missed log must not publish anything.
  }
  return { ok: true, suggestion };
}
