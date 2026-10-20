import { cleanPath, isAdminPath } from "@/lib/tour";
import { browseHref, chipBag } from "@/lib/understood-chips";

const ON = new Set(["1", "true", "yes", "on"]);

/** Off unless NEXT_PUBLIC_SULWE is 1, true, yes, or on. */
export function sulweOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return ON.has((env.NEXT_PUBLIC_SULWE ?? "").trim().toLowerCase());
}

export function sulweQueryOn(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("sulwe") === "1";
}

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const PAYMENT_PREFIXES = ["/orders", "/account/orders", "/upgrade", "/send-home", "/pricing"];

/** Admin, sign-in, and checkout or payment pages. Sulwe stays off these. */
export function sulweHiddenPath(path: string): boolean {
  const clean = cleanPath(path);
  if (isAdminPath(clean)) return true;
  if (AUTH_PATHS.includes(clean)) return true;
  return PAYMENT_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

/** The on-screen keyboard has shrunk the visual viewport. */
export function keyboardCoversScreen(input: { innerHeight: number; visualHeight: number }): boolean {
  if (input.innerHeight <= 0 || input.visualHeight <= 0) return false;
  return input.visualHeight < input.innerHeight * 0.75;
}

export function shouldShowSulwe(input: { path: string; flag: boolean; force: boolean; keyboard: boolean }): boolean {
  if (sulweHiddenPath(input.path)) return false;
  if (input.keyboard) return false;
  return input.flag || input.force;
}

export const SULWE_MIN_KEY = "rangach_sulwe_min";
export const SULWE_PREVIEW_KEY = "rangach_sulwe_preview";
export const SULWE_TOUR_KEY = "rangach_sulwe_tour";
/** Docked size in px. Was 56; Kevin asked for him to stand out (about 1.6 times). */
export const SULWE_SIZE = 92;
/** The minimised star badge. Was 32. */
export const SULWE_MIN_SIZE = 44;
export const SULWE_TOUR_SIZE = 72;
/** Gap between Sulwe and the bar or nav he sits above. */
export const SULWE_DOCK_GAP = 10;
/** Distance from the bottom edge when nothing is docked there (desktop). */
export const SULWE_DOCK_FALLBACK = 20;

export function readSulweMinimised(store: { getItem(key: string): string | null } | null): boolean {
  try {
    return store?.getItem(SULWE_MIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSulweMinimised(store: { setItem(key: string, value: string): void }, minimised: boolean): void {
  store.setItem(SULWE_MIN_KEY, minimised ? "1" : "0");
}

export const SULWE_REACTIONS = ["giggle", "jump", "wave", "spin", "blush", "peek"] as const;
export type SulweReaction = (typeof SULWE_REACTIONS)[number];

export const SULWE_IDLES = ["blink", "look", "yawn", "bounce", "float", "glow"] as const;

export const LONG_PRESS_MS = 500;
export const DOUBLE_TAP_MS = 400;

/** Next tap reaction. The bag empties before any reaction repeats. */
export function nextSulweReaction(
  bag: readonly SulweReaction[],
  random: () => number = Math.random,
): { reaction: SulweReaction; bag: SulweReaction[] } {
  const pool = bag.length > 0 ? [...bag] : [...SULWE_REACTIONS];
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  const reaction = pool[index] ?? SULWE_REACTIONS[0];
  pool.splice(index, 1);
  return { reaction, bag: pool };
}

/** A short tap reacts. A second tap soon after, or a held press, opens chat. */
export function classifySulwePointer(input: {
  kind: "up" | "long";
  heldMs: number;
  sinceLastTapMs: number | null;
}): { openChat: boolean; react: boolean } {
  const long = input.kind === "long" || input.heldMs >= LONG_PRESS_MS;
  if (long) return { openChat: true, react: false };
  const double = input.sinceLastTapMs !== null && input.sinceLastTapMs >= 0 && input.sinceLastTapMs <= DOUBLE_TAP_MS;
  return { openChat: double, react: true };
}

export function sulweHaptic(): void {
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(10);
  } catch {
    // Some browsers expose vibrate and then refuse the call.
  }
}

export const SULWE_CHIPS = [
  { id: "ayie", label: "sulwe_chip_ayie", query: "ayie catering" },
  { id: "fundi", label: "sulwe_chip_fundi", query: "fundi in Kisumu" },
  { id: "tilapia", label: "sulwe_chip_tilapia", query: "fresh tilapia" },
] as const;

export type SulweCard = { title: string; meta: string; href: string };

export type SulweHit = { kind: "listing" | "shop" | "offering"; title: string; city: string; href: string };

export function cardsFromHits(hits: SulweHit[]): SulweCard[] {
  return hits.slice(0, 3).map((hit) => ({ title: hit.title, meta: hit.city, href: hit.href }));
}

type CatalogueLike =
  | { kind: "listing"; listing: { id: string; title: string; city: string } }
  | { kind: "shop"; shop: { slug: string; name: string; city: string } }
  | { kind: "offering"; offering: { title: string; shopSlug: string; city: string } };

export function hitsFromCatalogue(hits: CatalogueLike[]): SulweHit[] {
  return hits.map((hit) => {
    if (hit.kind === "listing") {
      return { kind: "listing", title: hit.listing.title, city: hit.listing.city, href: `/listings/${hit.listing.id}` };
    }
    if (hit.kind === "shop") {
      return { kind: "shop", title: hit.shop.name, city: hit.shop.city, href: `/b/${hit.shop.slug}` };
    }
    return { kind: "offering", title: hit.offering.title, city: hit.offering.city, href: `/b/${hit.offering.shopSlug}` };
  });
}

export type SulweAskResult = {
  query: string;
  summary: string;
  href: string;
  cards: SulweCard[];
};

type ParsedSearch = {
  city: string;
  region: string;
  category: string;
  type: string;
  verified: boolean;
  occasion: string;
  hints: string[];
  summary: string;
};

/** Ask with the same sentence parser the listings page uses, then keep three cards. */
export async function sulweAsk(
  query: string,
  deps: {
    interpret: (input: string) => Promise<ParsedSearch>;
    search: (filters: {
      city?: string;
      region?: string;
      category?: string;
      type?: string;
      verified?: boolean;
      occasion?: string;
      hints?: string[];
      words?: string[];
      page?: number;
      pageSize?: number;
    }) => Promise<{ hits: CatalogueLike[] }>;
  },
): Promise<SulweAskResult> {
  const text = query.trim().slice(0, 200);
  if (!text) return { query: "", summary: "", href: "/listings", cards: [] };
  try {
    const parsed = await deps.interpret(text);
    const placed = Boolean(parsed.city || parsed.region || parsed.category || parsed.type || parsed.occasion);
    const page = await deps.search({
      city: parsed.city,
      region: parsed.region,
      category: parsed.category,
      type: parsed.type,
      verified: parsed.verified,
      occasion: parsed.occasion,
      hints: parsed.hints,
      words: placed ? [] : parsed.hints,
      page: 1,
      pageSize: 3,
    });
    const href = browseHref(
      "/listings",
      chipBag({
        nl: text,
        city: parsed.city,
        region: parsed.region,
        category: parsed.category,
        type: parsed.type,
        verified: parsed.verified,
        occasion: parsed.occasion,
      }),
    );
    return { query: text, summary: parsed.summary, href, cards: cardsFromHits(hitsFromCatalogue(page.hits)) };
  } catch {
    return {
      query: text,
      summary: "",
      href: browseHref("/listings", chipBag({ nl: text })),
      cards: [],
    };
  }
}

type SulweBox = { top: number; left: number; width: number; height: number };

/** Space Sulwe keeps from the bubble and the spotlight. */
export const SULWE_GUIDE_GAP = 6;

function boxesTouch(a: SulweBox, b: SulweBox, gap: number): boolean {
  return (
    a.left < b.left + b.width + gap &&
    a.left + a.width + gap > b.left &&
    a.top < b.top + b.height + gap &&
    a.top + a.height + gap > b.top
  );
}

/**
 * Put Sulwe next to the bubble without covering any of it (title, body, dots, buttons)
 * and without covering the spotlight. Tries, in order: the gap between bubble and spotlight,
 * beside the bubble, the far side of the bubble, beside the spotlight, then the screen corners.
 * Returns null when no spot on screen is free; the tour then runs without him for that step.
 */
export function placeSulwe(input: {
  bubble: { top: number; left: number; width: number; height: number };
  target: { top: number; left: number; width: number; height: number } | null;
  viewport: { width: number; height: number };
  size?: number;
}): { top: number; left: number } | null {
  const size = input.size ?? SULWE_TOUR_SIZE;
  const margin = 8;
  const gap = SULWE_GUIDE_GAP;
  const bubble = input.bubble;
  const target = input.target && input.target.width >= 2 && input.target.height >= 2 ? input.target : null;
  const { width: vw, height: vh } = input.viewport;
  const maxLeft = vw - size - margin;
  const maxTop = vh - size - margin;
  if (maxLeft < margin || maxTop < margin) return null;
  const clampLeft = (left: number) => Math.min(Math.max(margin, left), maxLeft);
  const clampTop = (top: number) => Math.min(Math.max(margin, top), maxTop);
  const free = (pos: { top: number; left: number }) => {
    const box = { top: pos.top, left: pos.left, width: size, height: size };
    if (pos.top < margin || pos.left < margin || pos.top > maxTop || pos.left > maxLeft) return false;
    if (boxesTouch(box, bubble, gap)) return false;
    return !(target && boxesTouch(box, target, gap));
  };

  const candidates: { top: number; left: number }[] = [];
  const bubbleBottom = bubble.top + bubble.height;
  const bubbleRight = bubble.left + bubble.width;
  if (target) {
    const targetBottom = target.top + target.height;
    const targetRight = target.left + target.width;
    const targetMid = target.left + target.width / 2 - size / 2;
    const bubbleBelow = bubble.top + bubble.height / 2 > target.top + target.height / 2;
    // 1. In the gap between the bubble and the spotlight, under or over the target.
    const gapTop = bubbleBelow ? (targetBottom + bubble.top - size) / 2 : (bubbleBottom + target.top - size) / 2;
    candidates.push({ top: gapTop, left: clampLeft(targetMid) });
    // 2. Beside the bubble, on the side nearer the target first.
    const besideTop = clampTop(bubbleBelow ? bubble.top : bubbleBottom - size);
    const right = { top: besideTop, left: bubbleRight + gap };
    const left = { top: besideTop, left: bubble.left - gap - size };
    candidates.push(...(targetMid > bubble.left + bubble.width / 2 ? [right, left] : [left, right]));
    // 3. The far side of the bubble, away from the target.
    const farTop = bubbleBelow ? bubbleBottom + gap : bubble.top - gap - size;
    candidates.push({ top: farTop, left: clampLeft(bubbleRight - size) }, { top: farTop, left: clampLeft(bubble.left) });
    // 4. Beside the spotlight.
    const sideTop = clampTop(target.top + target.height / 2 - size / 2);
    candidates.push({ top: sideTop, left: targetRight + gap }, { top: sideTop, left: target.left - gap - size });
  } else {
    candidates.push(
      { top: bubbleBottom + gap, left: clampLeft(bubbleRight - size) },
      { top: bubble.top - gap - size, left: clampLeft(bubbleRight - size) },
      { top: clampTop(bubble.top), left: bubbleRight + gap },
      { top: clampTop(bubble.top), left: bubble.left - gap - size },
    );
  }
  // 5. Screen corners.
  candidates.push(
    { top: maxTop, left: maxLeft },
    { top: maxTop, left: margin },
    { top: margin, left: maxLeft },
    { top: margin, left: margin },
  );
  const spot = candidates.map((pos) => ({ top: Math.round(pos.top), left: Math.round(pos.left) })).find(free);
  return spot ?? null;
}

/** Arrow from Sulwe toward the spotlight, so the speech comes from him. */
export function sulweGuideArrow(
  sulwe: { top: number; left: number },
  target: { top: number; left: number; width: number; height: number },
  size = SULWE_TOUR_SIZE,
): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: sulwe.left + size / 2,
    y1: sulwe.top + size * 0.42,
    x2: target.left + target.width / 2,
    y2: target.top + target.height / 2,
  };
}

/**
 * Bottom offset for the docked Sulwe. He sits above the highest bar fixed to the bottom
 * of the screen (bottom nav, sticky WhatsApp or call bar), so he never covers its buttons.
 * `obstacleTops` are the viewport tops of those bars; bars above mid-screen are ignored.
 */
export function sulweDockBottom(input: {
  viewportHeight: number;
  obstacleTops: readonly number[];
  gap?: number;
  fallback?: number;
}): number {
  const gap = input.gap ?? SULWE_DOCK_GAP;
  const fallback = input.fallback ?? SULWE_DOCK_FALLBACK;
  const height = input.viewportHeight;
  if (!(height > 0)) return fallback;
  const tops = input.obstacleTops.filter((top) => Number.isFinite(top) && top > height / 2 && top < height);
  if (tops.length === 0) return fallback;
  return Math.round(height - Math.min(...tops) + gap);
}

export type SulweSpark = { x: number; y: number; delay: number };

export type SulweWand = {
  /** Where he holds the wand, in viewport px. */
  hand: { x: number; y: number };
  /** Aim at the target, degrees clockwise from pointing right. */
  angle: number;
  /** The star tip once the swing ends. */
  tip: { x: number; y: number };
  /** Sparkle stops from the tip to the target, as offsets from the tip. */
  trail: SulweSpark[];
  /** Burst around the target, as offsets from the target centre. */
  burst: SulweSpark[];
  target: { x: number; y: number };
};

export const SULWE_WAND_LENGTH = 34;
/** Whole wand step: swing, trail, burst, then the spotlight and bubble. */
export const SULWE_WAND_MS = 850;
/** When the spotlight and bubble start to appear. */
export const SULWE_VOILA_MS = 480;

/** The wand swing, sparkle trail, and burst for one tour step. */
export function sulweWand(
  sulwe: { top: number; left: number },
  target: { top: number; left: number; width: number; height: number },
  size = SULWE_TOUR_SIZE,
  counts: { trail?: number; burst?: number } = {},
): SulweWand {
  const hand = { x: sulwe.left + (size * 132) / 200, y: sulwe.top + (size * 172) / 200 };
  const centre = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
  const raw = (Math.atan2(centre.y - hand.y, centre.x - hand.x) * 180) / Math.PI;
  const angle = Math.round(raw * 10) / 10;
  const rad = (angle * Math.PI) / 180;
  const tip = { x: hand.x + Math.cos(rad) * SULWE_WAND_LENGTH, y: hand.y + Math.sin(rad) * SULWE_WAND_LENGTH };
  const dx = centre.x - tip.x;
  const dy = centre.y - tip.y;
  const dist = Math.hypot(dx, dy) || 1;
  // A gentle arc: bend the path sideways by up to a fifth of its length.
  const bend = Math.min(60, dist * 0.2);
  const nx = -dy / dist;
  const ny = dx / dist;
  const control = { x: dx / 2 + nx * bend, y: dy / 2 + ny * bend };
  const trailCount = counts.trail ?? 10;
  const trail: SulweSpark[] = [];
  for (let i = 1; i <= trailCount; i += 1) {
    const t = i / trailCount;
    const u = 1 - t;
    trail.push({
      x: Math.round(2 * u * t * control.x + t * t * dx),
      y: Math.round(2 * u * t * control.y + t * t * dy),
      delay: 120 + Math.round(t * 240),
    });
  }
  const burstCount = counts.burst ?? 10;
  const rx = Math.min(70, target.width / 2 + 12);
  const ry = Math.min(50, target.height / 2 + 12);
  const burst: SulweSpark[] = [];
  for (let i = 0; i < burstCount; i += 1) {
    const a = (i / burstCount) * Math.PI * 2 - Math.PI / 2;
    burst.push({ x: Math.round(Math.cos(a) * rx), y: Math.round(Math.sin(a) * ry), delay: 380 + (i % 2) * 50 });
  }
  return { hand, angle, tip, trail, burst, target: centre };
}

/** How many times this browser has opened Sulwe's chat. The "Ask Sulwe anything" pill stops after this many. */
export const SULWE_OPENS_KEY = "rangach_sulwe_opens";
export const SULWE_ASK_MAX_OPENS = 3;

export function readSulweOpens(store: { getItem(key: string): string | null } | null): number {
  try {
    const value = Number.parseInt(store?.getItem(SULWE_OPENS_KEY) ?? "0", 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Count one chat open. Returns the new count; storage errors never stop the chat. */
export function bumpSulweOpens(store: { getItem(key: string): string | null; setItem(key: string, value: string): void } | null): number {
  const next = readSulweOpens(store) + 1;
  try {
    store?.setItem(SULWE_OPENS_KEY, String(next));
  } catch {
    // Private mode or a full store: the pill just keeps showing.
  }
  return next;
}

/** The speech-bubble pill beside the docked Sulwe. One bubble at a time, never over the chat or keyboard. */
export function shouldShowAskLabel(input: {
  show: boolean;
  minimised: boolean;
  touring: boolean;
  invite: boolean;
  chat: boolean;
  keyboard: boolean;
  opens: number;
}): boolean {
  if (!input.show || input.minimised || input.touring || input.invite || input.chat || input.keyboard) return false;
  return input.opens < SULWE_ASK_MAX_OPENS;
}

/** Gap between the pill's tail and Sulwe. */
export const SULWE_ASK_GAP = 6;

/**
 * Where the pill goes, in viewport px. Same free-space rule as placeSulwe: never touch Sulwe,
 * any obstacle (bottom nav, sticky WhatsApp bar, header) or the screen edge.
 * Tries beside Sulwe (left, level with his face), then above him, then below his face line.
 * Returns null when nothing is free; the pill then stays hidden.
 */
export function placeAskLabel(input: {
  sulwe: SulweBox;
  label: { width: number; height: number };
  viewport: { width: number; height: number };
  obstacles: readonly SulweBox[];
}): { top: number; left: number; side: "left" | "above" } | null {
  const margin = 8;
  const { sulwe, label, viewport } = input;
  const { width, height } = label;
  if (!(width > 0 && height > 0)) return null;
  const maxLeft = viewport.width - width - margin;
  const maxTop = viewport.height - height - margin;
  const clamp = (value: number, max: number) => Math.min(Math.max(margin, value), max);
  const free = (pos: { top: number; left: number }) => {
    if (pos.top < margin || pos.left < margin || pos.top > maxTop || pos.left > maxLeft) return false;
    const box = { top: pos.top, left: pos.left, width, height };
    if (boxesTouch(box, sulwe, 0)) return false;
    return !input.obstacles.some((obstacle) => obstacle.width > 0 && obstacle.height > 0 && boxesTouch(box, obstacle, 4));
  };
  const leftOf = sulwe.left - SULWE_ASK_GAP - width;
  const face = sulwe.top + sulwe.height * 0.32 - height / 2;
  const candidates: { top: number; left: number; side: "left" | "above" }[] = [
    { top: face, left: leftOf, side: "left" },
    { top: sulwe.top, left: leftOf, side: "left" },
    { top: sulwe.top + sulwe.height - height, left: leftOf, side: "left" },
    { top: sulwe.top - SULWE_ASK_GAP - height, left: clamp(sulwe.left + sulwe.width - width, maxLeft), side: "above" },
  ];
  const spot = candidates.map((pos) => ({ ...pos, top: Math.round(pos.top), left: Math.round(pos.left) })).find(free);
  return spot ?? null;
}
