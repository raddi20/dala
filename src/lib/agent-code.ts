/**
 * Brochure field-agent code from ?agent= on any page.
 *
 * Cookie: rangach_agent. First-party, HttpOnly, SameSite=Lax, Path=/, about 30 days.
 * No IP address and no device id are stored with it.
 *
 * First-touch, unless a new valid code arrives:
 * - A missing cookie is set from the first valid code.
 * - The same code on a later visit does not rewrite the cookie.
 * - A different valid code replaces the cookie and starts another 30 days.
 * - Junk is ignored, and the cookie already there is left as it is.
 *
 * Codes are trimmed and uppercased. A1 and a1 are the same code.
 * A code is 1–16 letters or digits. Anything else is junk.
 *
 * At sign-up the cookie is copied onto the new user. An account that already
 * exists is not updated, even if this cookie changes later.
 */

export const AGENT_COOKIE = "rangach_agent";
export const AGENT_COOKIE_DAYS = 30;
export const AGENT_COOKIE_MAX_AGE = AGENT_COOKIE_DAYS * 24 * 60 * 60;
export const AGENT_CODE_MAX = 16;

/** Admin row for accounts that had no code. Not itself an agent code. */
export const AGENT_NONE = "none";

const AGENT_CODE = /^[A-Z0-9]{1,16}$/;

/** Valid brochure code, or null when the value should be ignored. */
export function normalizeAgentCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!code || code.length > AGENT_CODE_MAX) return null;
  if (!AGENT_CODE.test(code)) return null;
  return code;
}

/**
 * Code to write on the cookie, or null when the cookie should stay as it is.
 * `incoming` is the ?agent= query value. `existing` is the cookie already stored.
 */
export function agentCodeToStore(existing: string | null | undefined, incoming: string | null | undefined): string | null {
  const next = normalizeAgentCode(incoming);
  if (!next) return null;
  const current = normalizeAgentCode(existing);
  if (current === next) return null;
  return next;
}

export function agentCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: AGENT_COOKIE_MAX_AGE,
    secure,
  };
}

/** Columns for a brand-new account. Nulls when the cookie is missing or junk. */
export function referralForNewAccount(cookie: string | null | undefined, now = new Date()) {
  const code = normalizeAgentCode(cookie);
  if (!code) return { referralAgentCode: null as string | null, referralAgentAt: null as Date | null };
  return { referralAgentCode: code, referralAgentAt: now };
}

export type AgentCountRow = {
  code: string;
  signups: number;
  shops: number;
  /** Shops with at least one offering that is not archived. */
  firstOfferings: number;
  /** Accounts with at least one directory listing (a classified, not a shop offering). */
  directoryListings: number;
};

/**
 * Sign-ups, shops, shops with an offering, and accounts with a directory listing.
 * `none` is always present, including when every count is zero.
 */
export function countAgentSignups(
  rows: { code: string | null; hasShop: boolean; hasOffering: boolean; hasListing: boolean }[],
): AgentCountRow[] {
  const buckets = new Map<string, AgentCountRow>();
  const bucket = (code: string) => {
    let row = buckets.get(code);
    if (!row) {
      row = { code, signups: 0, shops: 0, firstOfferings: 0, directoryListings: 0 };
      buckets.set(code, row);
    }
    return row;
  };
  bucket(AGENT_NONE);
  for (const row of rows) {
    const code = row.code?.trim() ? row.code.trim() : AGENT_NONE;
    const item = bucket(code);
    item.signups += 1;
    if (row.hasShop) item.shops += 1;
    if (row.hasOffering) item.firstOfferings += 1;
    if (row.hasListing) item.directoryListings += 1;
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.code === AGENT_NONE) return 1;
    if (b.code === AGENT_NONE) return -1;
    return a.code.localeCompare(b.code);
  });
}
