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

/**
 * Brochure codes that count as real field agents.
 * Kevin can replace this list without a code change by setting FIELD_AGENT_CODES
 * to a comma-separated list, for example A1,A2,A3,A4,A5, then redeploying.
 * Unset, blank, or only junk falls back to this list. Unknown codes are not stored.
 */
export const DEFAULT_AGENT_CODES = ["A1", "A2", "A3", "A4"] as const;

/** Admin row for stored codes that are not on the known list. */
export const AGENT_OTHER = "other";

/** Kisumu. Today, this week, and the launch weekend use this zone. No daylight saving. */
export const AGENT_REPORT_ZONE = "Africa/Nairobi";

/** Inclusive calendar dates for the Kisumu soft launch. */
export const LAUNCH_WEEKEND_FROM = "2026-10-17";
export const LAUNCH_WEEKEND_TO = "2026-10-18";

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function knownAgentCodes(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.FIELD_AGENT_CODES;
  if (raw === undefined || raw.trim() === "") return [...DEFAULT_AGENT_CODES];
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const part of raw.split(",")) {
    const code = normalizeAgentCode(part);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes.length > 0 ? codes : [...DEFAULT_AGENT_CODES];
}

/** Format-valid code that is on the known list, or null. */
export function acceptAgentCode(value: unknown, known: readonly string[] = knownAgentCodes()): string | null {
  const code = normalizeAgentCode(value);
  if (!code || !known.includes(code)) return null;
  return code;
}

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
export function agentCodeToStore(
  existing: string | null | undefined,
  incoming: string | null | undefined,
  known: readonly string[] = knownAgentCodes(),
): string | null {
  const next = acceptAgentCode(incoming, known);
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

/** Columns for a brand-new account. Nulls when the cookie is missing, junk, or not a known agent. */
export function referralForNewAccount(
  cookie: string | null | undefined,
  now = new Date(),
  known: readonly string[] = knownAgentCodes(),
) {
  const code = acceptAgentCode(cookie, known);
  if (!code) return { referralAgentCode: null as string | null, referralAgentAt: null as Date | null };
  return { referralAgentCode: code, referralAgentAt: now };
}

export type AgentCountRow = {
  code: string;
  signups: number;
  shops: number;
  /** Shops buyers can open: published, not taken down, and the owner is not suspended. */
  publishedShops: number;
  /** Shops with at least one offering that is not archived. */
  firstOfferings: number;
  /** Accounts with at least one directory listing (a classified, not a shop offering). */
  directoryListings: number;
};

export type AgentCountInput = {
  code: string | null;
  hasShop: boolean;
  hasPublishedShop?: boolean;
  hasOffering: boolean;
  hasListing: boolean;
  /** Sign-up time. referralAgentAt when the account has one, otherwise createdAt. */
  at?: Date | null;
};

export type AgentCountOptions = {
  /** When set, codes outside the list are counted as `other`, and each known code is always shown. */
  knownCodes?: readonly string[];
  /** Inclusive start. Null means no lower bound. */
  from?: Date | null;
  /** Exclusive end. Null means no upper bound. */
  to?: Date | null;
};

/**
 * Sign-ups, shops, published shops, shops with an offering, and accounts with a directory listing.
 * `none` is always present, including when every count is zero.
 * A from/to range keeps rows whose `at` is inside [from, to). Rows with no time are left out of a range.
 */
export function countAgentSignups(rows: AgentCountInput[], options: AgentCountOptions = {}): AgentCountRow[] {
  const known = options.knownCodes ? [...options.knownCodes] : null;
  const knownSet = known ? new Set(known) : null;
  const buckets = new Map<string, AgentCountRow>();
  const bucket = (code: string) => {
    let row = buckets.get(code);
    if (!row) {
      row = { code, signups: 0, shops: 0, publishedShops: 0, firstOfferings: 0, directoryListings: 0 };
      buckets.set(code, row);
    }
    return row;
  };
  if (known) {
    for (const code of known) bucket(code);
  }
  bucket(AGENT_NONE);
  for (const row of rows) {
    if (!inAgentRange(row.at, options.from, options.to)) continue;
    const item = bucket(agentBucket(row.code, knownSet));
    item.signups += 1;
    if (row.hasShop) item.shops += 1;
    if (row.hasPublishedShop) item.publishedShops += 1;
    if (row.hasOffering) item.firstOfferings += 1;
    if (row.hasListing) item.directoryListings += 1;
  }
  const other = buckets.get(AGENT_OTHER);
  if (other && other.signups === 0) buckets.delete(AGENT_OTHER);
  return [...buckets.values()].sort((a, b) => {
    const rank = agentRank(a.code, known) - agentRank(b.code, known);
    if (rank !== 0) return rank;
    return a.code.localeCompare(b.code);
  });
}

function agentBucket(code: string | null, known: Set<string> | null): string {
  const trimmed = code?.trim() ?? "";
  if (!trimmed) return AGENT_NONE;
  if (!known) return trimmed;
  const normalized = trimmed.toUpperCase();
  return known.has(normalized) ? normalized : AGENT_OTHER;
}

function inAgentRange(at: Date | null | undefined, from?: Date | null, to?: Date | null): boolean {
  if (!from && !to) return true;
  if (!at) return false;
  const time = at.getTime();
  if (from && time < from.getTime()) return false;
  if (to && time >= to.getTime()) return false;
  return true;
}

function agentRank(code: string, known: string[] | null): number {
  if (code === AGENT_NONE) return 10_000;
  if (code === AGENT_OTHER) return 9_000;
  if (known) {
    const index = known.indexOf(code);
    if (index >= 0) return index;
  }
  return 8_000;
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return bag;
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Midnight at the start of a calendar day in the report zone. */
export function zonedMidnight(year: number, month: number, day: number, timeZone = AGENT_REPORT_ZONE): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
}

export function parseAgentDay(value: string, timeZone = AGENT_REPORT_ZONE): Date | null {
  const match = DAY.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = zonedMidnight(year, month, day, timeZone);
  const parts = zonedParts(date, timeZone);
  if (Number(parts.year) !== year || Number(parts.month) !== month || Number(parts.day) !== day) return null;
  return date;
}

export type AgentPreset = "today" | "week" | "launch";

/** [from, to) in the report zone. Week starts Monday. Launch is 17–18 Oct 2026. */
export function agentPresetRange(preset: AgentPreset, now: Date, timeZone = AGENT_REPORT_ZONE): { from: Date; to: Date } {
  if (preset === "launch") {
    return {
      from: zonedMidnight(2026, 10, 17, timeZone),
      to: zonedMidnight(2026, 10, 19, timeZone),
    };
  }
  const parts = zonedParts(now, timeZone);
  const start = zonedMidnight(Number(parts.year), Number(parts.month), Number(parts.day), timeZone);
  if (preset === "today") return { from: start, to: new Date(start.getTime() + 86_400_000) };
  const weekday = WEEKDAY_INDEX[parts.weekday] ?? 0;
  const monday = new Date(start.getTime() - weekday * 86_400_000);
  return { from: monday, to: new Date(monday.getTime() + 7 * 86_400_000) };
}

export type AgentRange = {
  preset: "all" | AgentPreset | "custom";
  from: Date | null;
  to: Date | null;
  label: string;
  fromInput: string;
  toInput: string;
};

export function resolveAgentRange(
  input: { agents?: string; from?: string; to?: string },
  now = new Date(),
): AgentRange {
  const preset = input.agents?.trim() ?? "";
  if (preset === "today" || preset === "week" || preset === "launch") {
    const range = agentPresetRange(preset, now);
    return {
      preset,
      from: range.from,
      to: range.to,
      label: preset === "today" ? "Today" : preset === "week" ? "This week" : "Launch weekend, 17–18 Oct",
      fromInput: "",
      toInput: "",
    };
  }
  const from = input.from ? parseAgentDay(input.from) : null;
  const toDay = input.to ? parseAgentDay(input.to) : null;
  if (!from && !toDay) {
    return { preset: "all", from: null, to: null, label: "All dates", fromInput: "", toInput: "" };
  }
  let start = from;
  let end = toDay ? new Date(toDay.getTime() + 86_400_000) : null;
  if (start && end && start.getTime() > end.getTime()) {
    const swappedStart = new Date(end.getTime() - 86_400_000);
    end = new Date(start.getTime() + 86_400_000);
    start = swappedStart;
  }
  const fromInput = input.from && parseAgentDay(input.from) ? input.from : "";
  const toInput = input.to && parseAgentDay(input.to) ? input.to : "";
  const label = [fromInput || "the start", toInput || "now"].join(" – ");
  return { preset: "custom", from: start, to: end, label, fromInput, toInput };
}
