"use client";

import { RECENT_KEY, RECENT_MAX, SAVED_EVENT, SAVED_KEY, SAVED_MAX, parseList, type SavedItem } from "@/lib/saved";

function read(key: string, max: number): SavedItem[] {
  try {
    return parseList(window.localStorage.getItem(key), max);
  } catch {
    return [];
  }
}

function write(key: string, list: SavedItem[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Private mode or full storage. The heart still toggles for this page view.
  }
  window.dispatchEvent(new Event(SAVED_EVENT));
}

export const readSaved = () => read(SAVED_KEY, SAVED_MAX);
export const readRecent = () => read(RECENT_KEY, RECENT_MAX);
export const writeSaved = (list: SavedItem[]) => write(SAVED_KEY, list);
export const writeRecent = (list: SavedItem[]) => write(RECENT_KEY, list);

/** Best effort. A visitor without an account gets 401 and keeps the heart locally. */
export function syncHeart(id: string, saved: boolean) {
  void fetch("/api/saved", {
    method: saved ? "POST" : "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  }).catch(() => undefined);
}
