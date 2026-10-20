/** Shop reviews: validation, abuse checks, and the "How was it?" prompt rules. Pure, safe in the browser. */

export const SHOP_REVIEW_MIN = 3;
export const SHOP_REVIEW_MAX = 280;
export const SHOP_REVIEW_LIMIT = 5;
export const SHOP_REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SHOP_REVIEW_LIMIT_MESSAGE = "You've posted enough reviews for today. Try again tomorrow.";

export type ShopReviewStatus = "approved" | "pending" | "hidden";

// English and Swahili/Sheng swear words and slurs. Matched as whole words after undoing l33t spelling,
// so place names and ordinary words ("Scunthorpe", "class", "Kumbe") are not caught.
const BLOCKED = [
  "fuck", "fucker", "fucking", "motherfucker", "shit", "bullshit", "bitch", "bastard", "asshole", "arsehole",
  "cunt", "dick", "dickhead", "pussy", "whore", "slut", "nigger", "nigga", "faggot", "retard", "wanker",
  "malaya", "kuma", "kumamako", "mavi", "msenge", "shenzi", "mkundu", "matako", "mbwa koko",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

export function normaliseForCheck(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9@$!]/g, (ch) => LEET[ch] ?? ch)
    .replace(/[^a-z\s]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasProfanity(text: string) {
  const clean = ` ${normaliseForCheck(text)} `;
  const squashed = clean.replace(/(.)\1+/g, "$1");
  return BLOCKED.some((word) => {
    const w = ` ${word} `;
    const ws = w.replace(/(.)\1+/g, "$1");
    return clean.includes(w) || squashed.includes(ws) || clean.includes(` ${word}s `);
  });
}

/** A link or a phone number in a review goes to an admin first (spam, or moving a buyer off the site). */
export function needsModeration(text: string) {
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co\.ke|ke|net|org|io|me)\b)/i.test(text)) return true;
  return /(\d[\s-]?){7,}/.test(text);
}

export type ShopReviewInput = { rating: unknown; body: unknown };

export function checkShopReview(input: ShopReviewInput):
  | { ok: true; rating: number; body: string; status: ShopReviewStatus }
  | { ok: false; error: string } {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose 1 to 5 stars." };
  const body = String(input.body ?? "").replace(/\s+/g, " ").trim();
  if (body.length < SHOP_REVIEW_MIN) return { ok: false, error: "Write a few words about how it went." };
  if (body.length > SHOP_REVIEW_MAX) return { ok: false, error: `Keep it short, up to ${SHOP_REVIEW_MAX} characters.` };
  if (hasProfanity(body)) return { ok: false, error: "Please keep it polite. Say what went well or what didn't, without swear words." };
  return { ok: true, rating, body, status: needsModeration(body) ? "pending" : "approved" };
}

export function averageStars(rows: { rating: number }[]) {
  if (rows.length === 0) return null;
  return Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 10) / 10;
}

export function starText(rating: number) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ---- "How was it?" after a contact tap ----

export const CONTACTED_KEY = "rangach_contacted";
/** Ask only on a later visit: at least this long after the tap. */
export const ASK_AFTER_MS = 30 * 60 * 1000;
/** Stop asking after two weeks. */
export const ASK_UNTIL_MS = 14 * 24 * 60 * 60 * 1000;

export type ContactedShop = { slug: string; name: string; at: number; asked?: boolean };

export function parseContacted(text: string | null | undefined): ContactedShop[] {
  try {
    const rows: unknown = JSON.parse(text ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row): row is ContactedShop =>
        Boolean(row) && typeof row.slug === "string" && /^[a-z0-9-]{1,80}$/.test(row.slug) && typeof row.at === "number",
      )
      .map((row) => ({ slug: row.slug, name: String(row.name ?? "").slice(0, 80), at: row.at, asked: Boolean(row.asked) }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** Remembers a WhatsApp or call tap. A repeat tap restarts the clock and asks again later. */
export function recordContact(list: ContactedShop[], shop: { slug: string; name: string }, now = Date.now()) {
  return [{ slug: shop.slug, name: shop.name, at: now, asked: false }, ...list.filter((row) => row.slug !== shop.slug)].slice(0, 20);
}

/** The one shop to ask about now, or null. Never on that shop's own page right after the tap. */
export function pickHowWasIt(list: ContactedShop[], now = Date.now()): ContactedShop | null {
  return list.find((row) => !row.asked && now - row.at >= ASK_AFTER_MS && now - row.at <= ASK_UNTIL_MS) ?? null;
}

export function markAsked(list: ContactedShop[], slug: string) {
  return list.map((row) => (row.slug === slug ? { ...row, asked: true } : row));
}

export function howWasItText(name: string) {
  return name ? `How was it with ${name}?` : "How was it?";
}
