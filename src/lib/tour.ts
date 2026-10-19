import type { Lang } from "@/lib/i18n/lang";
import { uiFill, uiText, type StringKey } from "@/lib/i18n/strings";

const ON = new Set(["1", "true", "yes", "on"]);

/** Off unless NEXT_PUBLIC_GUIDED_TOUR is 1, true, yes, or on. */
export function guidedTourOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return ON.has((env.NEXT_PUBLIC_GUIDED_TOUR ?? "").trim().toLowerCase());
}

export type TourKind = "visitor" | "seller";

export type TourStep = {
  id: string;
  /** Matches `data-tour` on the page. Missing targets stay a centred bubble. */
  target: string;
  title: StringKey;
  body: StringKey;
};

export const VISITOR_STEPS: TourStep[] = [
  { id: "ask", target: "ask", title: "tour_ask_title", body: "tour_ask_body" },
  { id: "nav", target: "nav", title: "tour_nav_title", body: "tour_nav_body" },
  { id: "filters", target: "filters", title: "tour_filters_title", body: "tour_filters_body" },
  { id: "whatsapp", target: "whatsapp", title: "tour_whatsapp_title", body: "tour_whatsapp_body" },
  { id: "sell", target: "sell", title: "tour_sell_title", body: "tour_sell_body" },
];

export const SELLER_STEPS: TourStep[] = [
  { id: "offer", target: "sell-offer", title: "tour_seller_offer_title", body: "tour_seller_offer_body" },
  { id: "town", target: "sell-town", title: "tour_seller_town_title", body: "tour_seller_town_body" },
  { id: "publish", target: "sell-publish", title: "tour_seller_publish_title", body: "tour_seller_publish_body" },
];

export const VISITOR_TOUR_KEY = "rangach_tour";
export const SELLER_TOUR_KEY = "rangach_seller_tour";

export type TourRecord = { seen: boolean; step: number };

export type TourStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function cleanPath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

export function isAdminPath(path: string): boolean {
  const clean = cleanPath(path);
  return clean === "/admin" || clean.startsWith("/admin/");
}

/** Listing and shop creation. Other pages use the visitor tour. */
export function tourKindForPath(path: string): TourKind {
  const clean = cleanPath(path);
  if (clean === "/listings/new" || clean === "/account/storefront") return "seller";
  return "visitor";
}

export function stepsForKind(kind: TourKind): TourStep[] {
  return kind === "seller" ? SELLER_STEPS : VISITOR_STEPS;
}

export function storageKeyForKind(kind: TourKind): string {
  return kind === "seller" ? SELLER_TOUR_KEY : VISITOR_TOUR_KEY;
}

export function parseTourRecord(raw: string | null | undefined): TourRecord {
  if (!raw) return { seen: false, step: 0 };
  if (raw === "seen") return { seen: true, step: 0 };
  const step = /^step:(\d+)$/.exec(raw);
  if (step) return { seen: false, step: Number(step[1]) };
  return { seen: false, step: 0 };
}

export function serializeTourRecord(record: TourRecord): string {
  if (record.seen) return "seen";
  return `step:${Math.max(0, Math.floor(record.step))}`;
}

export function readTourRecord(store: TourStore | null, cookieHeader: string, key: string): TourRecord {
  let raw: string | null = null;
  try {
    raw = store?.getItem(key) ?? null;
  } catch {
    raw = null;
  }
  if (raw) return parseTourRecord(raw);
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${key}=`));
  if (!pair) return { seen: false, step: 0 };
  return parseTourRecord(decodeURIComponent(pair.slice(key.length + 1)));
}

/** Writes local storage when it works, and returns the cookie fallback. */
export function persistTourRecord(store: TourStore | null, key: string, record: TourRecord): string {
  const value = serializeTourRecord(record);
  try {
    store?.setItem(key, value);
  } catch {
    // Private mode can throw. The cookie still remembers the device.
  }
  return `${key}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function advanceTour(record: TourRecord, stepCount: number): TourRecord {
  const next = record.step + 1;
  if (next >= stepCount) return { seen: true, step: 0 };
  return { seen: false, step: next };
}

export function skipTour(): TourRecord {
  return { seen: true, step: 0 };
}

export function replayTour(): TourRecord {
  return { seen: false, step: 0 };
}

export function tourQueryOn(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("tour") === "1";
}

/** First visit, a replay, or ?tour=1. Never on admin, and hidden while the flag is off. */
export function shouldShowTour(input: {
  path: string;
  flag: boolean;
  force: boolean;
  seen: boolean;
}): boolean {
  if (isAdminPath(input.path)) return false;
  if (input.force) return true;
  if (!input.flag) return false;
  return !input.seen;
}

export type TourBox = { top: number; left: number; width: number; height: number };

/** The first box that is actually on screen. A missing or hidden target has no spotlight. */
export function visibleTourBox(boxes: TourBox[], viewport?: { width: number; height: number }): TourBox | null {
  return (
    boxes.find((box) => {
      if (box.width < 2 || box.height < 2) return false;
      if (!viewport) return true;
      const vertical = box.top < viewport.height && box.top + box.height > 0;
      const horizontal = box.left < viewport.width && box.left + box.width > 0;
      return vertical && horizontal;
    }) ?? null
  );
}

const NAV_LABELS = ["nav_home", "nav_explore", "nav_ask", "nav_occasions", "nav_sell"] as const;

/** Bottom-nav words, in the visitor's language, from the same strings the tabs use. */
export function tourBody(lang: Lang, step: TourStep): string {
  if (step.body !== "tour_nav_body") return uiText(lang, step.body);
  const [home, explore, ask, occasions, sell] = NAV_LABELS.map((key) => uiText(lang, key));
  return uiFill(lang, "tour_nav_body", { home, explore, ask, occasions, sell });
}
