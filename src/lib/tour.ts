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
  /** Matches `data-tour` on the page. A missing target becomes a centred bubble. */
  target: string;
  title: StringKey;
  body: StringKey;
  /** Go to this path before spotlighting. Omitted means stay put. */
  path?: string;
  /** Open the listings filter sheet so the town select is on screen. */
  openFilters?: boolean;
  /** Drop this step when no public WhatsApp listing exists. */
  needsListing?: boolean;
};

export const VISITOR_STEPS: TourStep[] = [
  { id: "ask", target: "ask", title: "tour_ask_title", body: "tour_ask_body", path: "/" },
  { id: "home", target: "tour-tab-home", title: "nav_home", body: "tour2_home_body" },
  { id: "explore", target: "tour-tab-explore", title: "nav_explore", body: "tour2_explore_body" },
  { id: "ask-tab", target: "tour-tab-ask", title: "nav_ask", body: "tour2_ask_tab_body" },
  { id: "occasions", target: "tour-tab-occasions", title: "nav_occasions", body: "tour2_occasions_body" },
  { id: "filters", target: "filters", title: "tour_filters_title", body: "tour_filters_body", path: "/listings" },
  { id: "town", target: "tour-town", title: "town", body: "tour2_town_body", path: "/listings", openFilters: true },
  { id: "whatsapp", target: "whatsapp", title: "tour_whatsapp_title", body: "tour_whatsapp_body", needsListing: true },
  { id: "sell", target: "sell", title: "tour_sell_title", body: "tour_sell_body" },
];

export const SELLER_STEPS: TourStep[] = [
  { id: "title", target: "sell-title", title: "tour_seller_offer_title", body: "tour_seller_offer_body" },
  { id: "photo", target: "sell-photo", title: "tour2_photo_title", body: "tour2_photo_body" },
  { id: "price", target: "sell-price", title: "tour2_price_title", body: "tour2_price_body" },
  { id: "publish", target: "sell-publish", title: "tour_seller_publish_title", body: "tour_seller_publish_body" },
];

export const TAB_STEP_IDS = ["home", "explore", "ask-tab", "occasions", "sell"] as const;

export const VISITOR_TOUR_KEY = "rangach_tour";
export const SELLER_TOUR_KEY = "rangach_seller_tour";
export const TOUR_RUN_KEY = "rangach_tour_run";

export type TourRecord = { seen: boolean; step: number };

export type TourRun = { kind: TourKind; stepId: string; startPath: string };

export type TourStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function cleanPath(path: string): string {
  const bare = (path || "/").split("?")[0].split("#")[0];
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
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

/** Hide the WhatsApp step until a real listing path is known. */
export function stepsForRun(kind: TourKind, listingPath: string | null | undefined): TourStep[] {
  const steps = stepsForKind(kind);
  if (listingPath) return steps;
  return steps.filter((step) => !step.needsListing);
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

export function serializeTourRun(run: TourRun): string {
  return JSON.stringify({ kind: run.kind, stepId: run.stepId, startPath: cleanPath(run.startPath) });
}

export function parseTourRun(raw: string | null | undefined): TourRun | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TourRun>;
    if (value.kind !== "visitor" && value.kind !== "seller") return null;
    if (typeof value.stepId !== "string" || !value.stepId) return null;
    if (typeof value.startPath !== "string" || !value.startPath) return null;
    return { kind: value.kind, stepId: value.stepId, startPath: cleanPath(value.startPath) };
  } catch {
    return null;
  }
}

/** Step to show after a route change. An unknown id starts over. */
export function resumedStepId(raw: string | null | undefined, kind: TourKind, steps: TourStep[]): string {
  const run = parseTourRun(raw);
  if (!run || run.kind !== kind) return steps[0]?.id ?? "";
  if (!steps.some((step) => step.id === run.stepId)) return steps[0]?.id ?? "";
  return run.stepId;
}

export function stepById(steps: TourStep[], id: string): TourStep {
  return steps.find((step) => step.id === id) ?? steps[0];
}

export function neighborStep(steps: TourStep[], id: string, direction: 1 | -1): { id: string; done: boolean } {
  const index = Math.max(0, steps.findIndex((step) => step.id === id));
  const next = index + direction;
  if (next >= steps.length) return { id, done: true };
  if (next < 0) return { id: steps[0].id, done: false };
  return { id: steps[next].id, done: false };
}

/** Where the step lives. The WhatsApp step uses the listing the API found. */
export function stepPath(step: TourStep, listingPath: string | null | undefined): string | null {
  if (step.needsListing) return listingPath || null;
  return step.path ?? null;
}

export function pathsMatch(current: string, target: string): boolean {
  return cleanPath(current) === cleanPath(target);
}

/** Null when the visitor is already on the page where the tour began. */
export function finishHref(startPath: string, currentPath: string): string | null {
  const start = cleanPath(startPath || "/");
  if (start === cleanPath(currentPath)) return null;
  return start;
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
  /** A tour already walking across pages stays up after the preview query is left behind. */
  activeRun?: boolean;
}): boolean {
  if (isAdminPath(input.path)) return false;
  if (input.force || input.activeRun) return true;
  if (!input.flag) return false;
  return !input.seen;
}

/** Session flag: the visitor said yes to the tour invite, or asked for a replay. */
export const TOUR_ACCEPT_KEY = "rangach_tour_yes";
/** Fired when the invite is answered. */
export const TOUR_PROMPT_EVENT = "rangach-tour-prompt";

/** Remembers "Not now" per tour kind, so the invite is not asked again on this device. */
export function tourPromptKey(kind: TourKind): string {
  return `rangach_tour_prompt_${kind}`;
}

export function readTourDeclined(store: { getItem(key: string): string | null } | null, kind: TourKind): boolean {
  try {
    return store?.getItem(tourPromptKey(kind)) === "no";
  } catch {
    return false;
  }
}

export function writeTourDeclined(store: { setItem(key: string, value: string): void } | null, kind: TourKind): void {
  try {
    store?.setItem(tourPromptKey(kind), "no");
  } catch {
    // Private mode can throw. The invite then shows again next visit, which is harmless.
  }
}

export type TourEntry = "tour" | "prompt" | "none";

/**
 * What a visit gets. A first-time visitor is invited instead of the tour starting on its own.
 * ?tour=1, a run already in progress, a "Yes, show me", or a replay go straight to the tour.
 * "Not now", finishing, or skipping (seen) stop the invite coming back.
 */
export function tourEntry(input: {
  path: string;
  flag: boolean;
  force: boolean;
  seen: boolean;
  activeRun?: boolean;
  accepted: boolean;
  declined: boolean;
}): TourEntry {
  if (isAdminPath(input.path)) return "none";
  if (input.force || input.activeRun) return "tour";
  if (!input.flag || input.seen) return "none";
  if (input.accepted) return "tour";
  if (input.declined) return "none";
  return "prompt";
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

export type TourPlacement = {
  spot: TourBox | null;
  bubble: TourBox;
  side: "above" | "below" | "center";
  arrow: { x1: number; y1: number; x2: number; y2: number } | null;
};

const SPOT_PAD = 8;
const BUBBLE_GAP = 14;
const SCREEN_MARGIN = 8;

/** Place the bubble beside the target, flipping above or below, and clamp it on screen. */
export function placeTourBubble(input: {
  target: TourBox | null;
  viewport: { width: number; height: number };
  bubbleHeight: number;
  bubbleWidth?: number;
}): TourPlacement {
  const width = Math.min(input.bubbleWidth ?? 300, Math.max(160, input.viewport.width - SCREEN_MARGIN * 2));
  const height = input.bubbleHeight;
  const maxLeft = Math.max(SCREEN_MARGIN, input.viewport.width - width - SCREEN_MARGIN);
  const maxTop = Math.max(SCREEN_MARGIN, input.viewport.height - height - SCREEN_MARGIN);
  const target = input.target && input.target.width >= 2 && input.target.height >= 2 ? input.target : null;

  if (!target) {
    return {
      spot: null,
      side: "center",
      arrow: null,
      bubble: {
        top: Math.min(Math.max(SCREEN_MARGIN, (input.viewport.height - height) / 2), maxTop),
        left: Math.min(Math.max(SCREEN_MARGIN, (input.viewport.width - width) / 2), maxLeft),
        width,
        height,
      },
    };
  }

  const spot = {
    top: target.top - SPOT_PAD,
    left: target.left - SPOT_PAD,
    width: target.width + SPOT_PAD * 2,
    height: target.height + SPOT_PAD * 2,
  };
  const belowTop = spot.top + spot.height + BUBBLE_GAP;
  const aboveTop = spot.top - BUBBLE_GAP - height;
  const fitsBelow = belowTop + height <= input.viewport.height - SCREEN_MARGIN;
  const fitsAbove = aboveTop >= SCREEN_MARGIN;
  let side: "above" | "below";
  let top: number;
  if (fitsBelow) {
    side = "below";
    top = belowTop;
  } else if (fitsAbove) {
    side = "above";
    top = aboveTop;
  } else if (input.viewport.height - belowTop >= spot.top - BUBBLE_GAP) {
    side = "below";
    top = belowTop;
  } else {
    side = "above";
    top = aboveTop;
  }
  top = Math.min(Math.max(SCREEN_MARGIN, top), maxTop);
  const preferredLeft = target.left + target.width / 2 - width / 2;
  const left = Math.min(Math.max(SCREEN_MARGIN, preferredLeft), maxLeft);
  const bubble = { top, left, width, height };
  const arrow = {
    x1: left + width / 2,
    y1: side === "below" ? top : top + height,
    x2: target.left + target.width / 2,
    y2: side === "below" ? target.top + target.height : target.top,
  };
  return { spot, bubble, side, arrow };
}

const NAV_LABELS = ["nav_home", "nav_explore", "nav_ask", "nav_occasions", "nav_sell"] as const;

/** Bottom-nav words, in the visitor's language, from the same strings the tabs use. */
export function tourBody(lang: Lang, step: TourStep): string {
  if (step.body !== "tour_nav_body") return uiText(lang, step.body);
  const [home, explore, ask, occasions, sell] = NAV_LABELS.map((key) => uiText(lang, key));
  return uiFill(lang, "tour_nav_body", { home, explore, ask, occasions, sell });
}
