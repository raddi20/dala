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
export const SULWE_SIZE = 56;
export const SULWE_TOUR_SIZE = 72;

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
