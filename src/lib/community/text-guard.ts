import { UPDATE_BLOCKLIST, blocklistPhrases } from "@/lib/community/blocklist";

/** Short enough for a shop note, long enough for a morning's news. */
export const UPDATE_MAX = 400;

export const UPDATE_EMPTY = "Write a short note about what's new at the shop.";
export const UPDATE_TOO_LONG = `Keep it to ${UPDATE_MAX} characters.`;
export const UPDATE_MONEY = "Shop updates can't ask for money or include a phone number. People reach you from the shop page.";
export const UPDATE_POLITICS = "Shop updates stay about the shop. Leave politics and campaigns off this note.";
export const UPDATE_SCAM = "That note looks like a money scheme. Tell people what's new in the shop instead.";
export const UPDATE_PAUSED = "Shop updates are paused for now. You can post again when they open.";
export const UPDATE_POST_LIMIT = 12;
export const UPDATE_POST_WINDOW_MS = 24 * 60 * 60 * 1000;
export const UPDATE_POST_LIMIT_MESSAGE = "That's enough updates for today. Try again tomorrow.";

const PHONE =
  /(?:\+?\s*254|0)[\s-]?[17](?:[\s-]?\d){8}\b|\+\d(?:[\s-]?\d){8,}\b|\b\d{7,}\b/;

function squash(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

export function phraseHit(text: string, phrases: readonly string[]): string | null {
  const clean = squash(text);
  for (const phrase of phrases) {
    const needle = ` ${phrase.toLowerCase().replace(/-/g, " ")} `;
    const raw = ` ${phrase.toLowerCase()} `;
    if (clean.includes(needle) || clean.includes(raw)) return phrase;
  }
  return null;
}

export function hasPhoneNumber(text: string): boolean {
  return PHONE.test(text);
}

export function checkUpdateText(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.replace(/\s+/g, " ").trim();
  if (!body) return { ok: false, error: UPDATE_EMPTY };
  if (body.length > UPDATE_MAX) return { ok: false, error: UPDATE_TOO_LONG };
  if (phraseHit(body, UPDATE_BLOCKLIST.politics.en) || phraseHit(body, [...UPDATE_BLOCKLIST.politics.sw, ...UPDATE_BLOCKLIST.politics.sheng, ...UPDATE_BLOCKLIST.politics.dholuo])) {
    return { ok: false, error: UPDATE_POLITICS };
  }
  if (phraseHit(body, UPDATE_BLOCKLIST.scam)) return { ok: false, error: UPDATE_SCAM };
  if (phraseHit(body, UPDATE_BLOCKLIST.money) || hasPhoneNumber(body)) return { ok: false, error: UPDATE_MONEY };
  return { ok: true, body };
}

/** Used by tests to prove the list is the one the checker reads. */
export function guardedPhrases(): string[] {
  return blocklistPhrases();
}
