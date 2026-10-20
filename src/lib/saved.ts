/**
 * Saved listings and Recently viewed. Pure helpers, safe on the server and in the browser.
 * Storage is localStorage, so no account is needed. A signed-in person also syncs Saved to SavedListing.
 */
export const SAVED_KEY = "rangach_saved";
export const RECENT_KEY = "rangach_recent";
export const SAVED_MAX = 100;
export const RECENT_MAX = 12;
export const SAVED_EVENT = "rangach:saved";

export type SavedItem = {
  id: string;
  title: string;
  photo: string;
  price: string;
  place: string;
  at: number;
};

const ID = /^[a-z0-9]{8,40}$/i;

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function cleanItem(raw: unknown): SavedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = clip(row.id, 40);
  if (!ID.test(id)) return null;
  const photo = clip(row.photo, 600);
  return {
    id,
    title: clip(row.title, 140),
    photo: /^(https?:\/\/|\/)/.test(photo) ? photo : "",
    price: clip(row.price, 60),
    place: clip(row.place, 60),
    at: typeof row.at === "number" && Number.isFinite(row.at) ? row.at : 0,
  };
}

/** Bad JSON or a tampered value gives an empty list, never a crash. */
export function parseList(text: string | null | undefined, max: number): SavedItem[] {
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: SavedItem[] = [];
    for (const raw of parsed) {
      const item = cleanItem(raw);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function isSaved(list: SavedItem[], id: string) {
  return list.some((item) => item.id === id);
}

/** Newest first. Tapping again removes it. */
export function toggleSaved(list: SavedItem[], item: SavedItem, now = Date.now()): { list: SavedItem[]; saved: boolean } {
  if (isSaved(list, item.id)) return { list: list.filter((row) => row.id !== item.id), saved: false };
  return { list: [{ ...item, at: now }, ...list].slice(0, SAVED_MAX), saved: true };
}

/** Moves a viewed listing to the front and keeps the last RECENT_MAX. */
export function pushRecent(list: SavedItem[], item: SavedItem, now = Date.now()): SavedItem[] {
  return [{ ...item, at: now }, ...list.filter((row) => row.id !== item.id)].slice(0, RECENT_MAX);
}

/**
 * Local hearts plus the account's hearts. Server rows win for title and photo (they are fresh),
 * every id from either side is kept, newest first.
 */
export function mergeSaved(local: SavedItem[], server: SavedItem[]): SavedItem[] {
  const byId = new Map<string, SavedItem>();
  for (const item of local) byId.set(item.id, item);
  for (const item of server) {
    const prior = byId.get(item.id);
    byId.set(item.id, { ...item, at: Math.max(item.at, prior?.at ?? 0) });
  }
  return [...byId.values()].sort((a, b) => b.at - a.at).slice(0, SAVED_MAX);
}

/** Ids in local that the account does not have yet. Sent once on sign-in. */
export function missingOnServer(local: SavedItem[], serverIds: Iterable<string>): string[] {
  const have = new Set(serverIds);
  return local.map((item) => item.id).filter((id) => !have.has(id));
}

export function cleanIds(raw: unknown, max = SAVED_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && ID.test(id)))].slice(0, max);
}
