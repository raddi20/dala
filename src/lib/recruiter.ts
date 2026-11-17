/**
 * Shop recruiter links.
 * Long form: /list-your-shop?ref=irene
 * Short form: /r/irene (easier to tap in chat). It redirects to the long form.
 *
 * The code is trimmed and lowercased. It must match [a-z0-9-]{2,32}.
 * Irene and irene are the same code. Anything else is ignored.
 *
 * Persistence through sign-up:
 * - The proxy stores a valid code in the rangach_recruiter cookie (30 days,
 *   HttpOnly, SameSite=Lax, this site only) when the visit is /list-your-shop
 *   or the short link /r/<code>. A later valid code replaces it. Junk does not
 *   clear a code already stored. A ?ref= on any other page, including Rangach
 *   Business, does not set this cookie.
 * - /r/<code> is public. It answers with a temporary redirect to
 *   /list-your-shop?ref=<code> and sets that same cookie. An invalid code still
 *   redirects to /list-your-shop, with no ref. A well-formed code is not looked
 *   up here: an unknown code is kept on the visit, and the shop is still created
 *   without it, the same as opening the long link directly.
 * - The browser also keeps the same code in localStorage under rangach_recruiter,
 *   so a hidden field can still be filled if the cookie is missing.
 * - Starting the shop sends that code in a hidden field. The server action reads
 *   the field, and the cookie when the field is empty.
 *
 * What is saved on the shop (Storefront.recruiterCode):
 * - The code, only when it belongs to an active recruiter at that moment.
 * - Null when there is no code, the format is wrong, the code is unknown, or the
 *   recruiter is inactive. The shop is still created. Unknown codes are not stored.
 * - A code already on a shop is never rewritten.
 *
 * This week uses Africa/Nairobi and starts on Monday, the same window as field agents.
 */

import { AGENT_REPORT_ZONE, agentPresetRange } from "@/lib/agent-code";

export const LIST_YOUR_SHOP_PATH = "/list-your-shop";
export const RECRUITER_COOKIE = "rangach_recruiter";
export const RECRUITER_STORAGE_KEY = "rangach_recruiter";
export const RECRUITER_COOKIE_DAYS = 30;
export const RECRUITER_COOKIE_MAX_AGE = RECRUITER_COOKIE_DAYS * 24 * 60 * 60;

/** Kevin's recruiter. Created when missing. A later edit of the name or active flag is left alone. */
export const SEEDED_RECRUITER = { code: "irene", name: "Irene" } as const;

const RECRUITER_CODE = /^[a-z0-9-]{2,32}$/;
const NAME_MAX = 80;

export function normalizeRecruiterCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  if (!RECRUITER_CODE.test(code)) return null;
  return code;
}

/**
 * Code to write on the cookie, or null when the cookie should stay as it is.
 * `incoming` is the ?ref= query on /list-your-shop.
 */
export function recruiterCodeToStore(existing: string | null | undefined, incoming: string | null | undefined): string | null {
  const next = normalizeRecruiterCode(incoming);
  if (!next) return null;
  if (normalizeRecruiterCode(existing) === next) return null;
  return next;
}

export function recruiterCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: RECRUITER_COOKIE_MAX_AGE,
    secure,
  };
}

/** Code to show and to put in the hidden field. A valid ?ref= wins. Otherwise the cookie. */
export function recruiterCodeFromVisit(query: string | null | undefined, cookie: string | null | undefined): string {
  return normalizeRecruiterCode(query) ?? normalizeRecruiterCode(cookie) ?? "";
}

/**
 * Value for the hidden field, and the localStorage write when a valid code arrived.
 * An invalid ?ref= falls through to the cookie value, then to what was already stored.
 */
export function recruiterRefToRemember(
  urlRef: string | null | undefined,
  stored: string | null | undefined,
  server: string | null | undefined,
): { value: string; write: string | null } {
  const fromUrl = normalizeRecruiterCode(urlRef);
  if (fromUrl) return { value: fromUrl, write: fromUrl };
  const fromServer = normalizeRecruiterCode(server);
  if (fromServer) return { value: fromServer, write: fromServer };
  const fromStore = normalizeRecruiterCode(stored);
  if (fromStore) return { value: fromStore, write: null };
  return { value: "", write: null };
}

export function recruiterSignupUrl(origin: string, code: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${LIST_YOUR_SHOP_PATH}?ref=${encodeURIComponent(code)}`;
}

/** Short share link. /r/irene is the form people copy into chat. */
export const RECRUITER_SHORT_PREFIX = "/r";

export function recruiterShortUrl(origin: string, code: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${RECRUITER_SHORT_PREFIX}/${encodeURIComponent(code)}`;
}

/** True for /r and /r/<code>. Does not match /register or /reset-password. */
export function isRecruiterShortPath(pathname: string) {
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/";
  return path === RECRUITER_SHORT_PREFIX || path.startsWith(`${RECRUITER_SHORT_PREFIX}/`);
}

function decodePathSegment(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Code from /r/<code>, or null when that path is not a single valid code. */
export function recruiterCodeFromShortPath(pathname: string): string | null {
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/";
  const prefix = `${RECRUITER_SHORT_PREFIX}/`;
  if (!path.startsWith(prefix)) return null;
  const segment = path.slice(prefix.length);
  if (!segment || segment.includes("/")) return null;
  return normalizeRecruiterCode(decodePathSegment(segment));
}

/**
 * Where /r/<code> sends the visitor.
 * A valid code keeps ?ref=, including when no recruiter row exists yet.
 * An invalid code opens the form with no ref.
 */
export function recruiterShortHop(raw: string): { code: string | null; path: string } {
  const code = normalizeRecruiterCode(decodePathSegment(raw));
  if (!code) return { code: null, path: LIST_YOUR_SHOP_PATH };
  return { code, path: `${LIST_YOUR_SHOP_PATH}?ref=${encodeURIComponent(code)}` };
}

type RecruiterRow = { code: string; active: boolean };

/**
 * Code to copy onto a new shop.
 * A non-empty form value wins, including when it is junk or unmatched (the cookie is not used instead).
 * An empty form falls through to the cookie.
 * Unknown and inactive codes become null. The caller still creates the shop.
 */
export async function recruiterCodeForNewShop(
  sources: { form?: string | null; cookie?: string | null },
  findRecruiter: (code: string) => Promise<RecruiterRow | null>,
): Promise<string | null> {
  const formText = sources.form ?? "";
  const raw = formText.trim() ? normalizeRecruiterCode(formText) : normalizeRecruiterCode(sources.cookie);
  if (!raw) return null;
  const row = await findRecruiter(raw);
  if (!row?.active) return null;
  return row.code;
}

export async function openShopWithReferral(input: {
  form?: string | null;
  cookie?: string | null;
  findRecruiter: (code: string) => Promise<RecruiterRow | null>;
  createShop: (data: { recruiterCode: string | null }) => Promise<{ id: string; recruiterCode: string | null }>;
}) {
  const recruiterCode = await recruiterCodeForNewShop(
    { form: input.form ?? "", cookie: input.cookie ?? null },
    input.findRecruiter,
  );
  return input.createShop({ recruiterCode });
}

export function referredShopStatus(shop: { published: boolean; hidden: boolean }): "Draft" | "Published" | "Taken down" {
  if (shop.hidden) return "Taken down";
  if (shop.published) return "Published";
  return "Draft";
}

/** Inclusive of shops opened from Monday 00:00 Nairobi up to, but not including, next Monday. */
export function countReferredShops(dates: readonly Date[], now = new Date()) {
  const week = agentPresetRange("week", now, AGENT_REPORT_ZONE);
  let thisWeek = 0;
  for (const at of dates) {
    const time = at.getTime();
    if (time >= week.from.getTime() && time < week.to.getTime()) thisWeek += 1;
  }
  return { thisWeek, allTime: dates.length };
}

export function cleanRecruiterName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > NAME_MAX) return null;
  return name;
}

export function parseActiveFlag(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "active") return true;
  if (value === "0" || value === "false" || value === "no" || value === "inactive") return false;
  return null;
}

export type RecruiterAudit = {
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
};

export async function addRecruiter(input: {
  code: string;
  name: string;
  findByCode: (code: string) => Promise<{ id: string } | null>;
  create: (data: { code: string; name: string; active: true }) => Promise<{ id: string; code: string }>;
  audit: (entry: RecruiterAudit) => Promise<void>;
}): Promise<{ ok: true; id: string; code: string } | { ok: false; code: "format" | "name" | "taken" }> {
  const code = normalizeRecruiterCode(input.code);
  if (!code) return { ok: false, code: "format" };
  const name = cleanRecruiterName(input.name);
  if (!name) return { ok: false, code: "name" };
  const existing = await input.findByCode(code);
  if (existing) return { ok: false, code: "taken" };
  const created = await input.create({ code, name, active: true });
  await input.audit({
    action: "recruiter.add",
    targetType: "recruiter",
    targetId: created.id,
    reason: `Added ${name} (${code}).`,
  });
  return { ok: true, id: created.id, code: created.code };
}

export async function editRecruiter(input: {
  id: string;
  name: string;
  active: string;
  find: (id: string) => Promise<{ id: string; code: string; name: string; active: boolean } | null>;
  update: (id: string, data: { name: string; active: boolean }) => Promise<void>;
  audit: (entry: RecruiterAudit) => Promise<void>;
}): Promise<{ ok: true; changed: boolean } | { ok: false; code: "name" | "active" | "missing" }> {
  const name = cleanRecruiterName(input.name);
  if (!name) return { ok: false, code: "name" };
  const active = parseActiveFlag(input.active);
  if (active === null) return { ok: false, code: "active" };
  const current = await input.find(input.id);
  if (!current) return { ok: false, code: "missing" };
  if (current.name === name && current.active === active) return { ok: true, changed: false };
  await input.update(input.id, { name, active });
  const parts: string[] = [];
  if (current.name !== name) parts.push(`Name ${current.name} → ${name}.`);
  if (current.active !== active) parts.push(active ? "Active again." : "Deactivated.");
  await input.audit({
    action: "recruiter.update",
    targetType: "recruiter",
    targetId: current.id,
    reason: `${current.code}: ${parts.join(" ")}`,
  });
  return { ok: true, changed: true };
}

export type RecruiterSeedDb = {
  recruiter: {
    findUnique: (args: { where: { code: string }; select: { id: true } }) => Promise<{ id: string } | null>;
    create: (args: { data: { code: string; name: string; active: boolean } }) => Promise<unknown>;
  };
};

/** Insert Irene when that code is missing. Does not rename her or turn her back on. */
export async function ensureSeedRecruiter(db: RecruiterSeedDb): Promise<{ created: boolean }> {
  const existing = await db.recruiter.findUnique({
    where: { code: SEEDED_RECRUITER.code },
    select: { id: true },
  });
  if (existing) return { created: false };
  await db.recruiter.create({
    data: { code: SEEDED_RECRUITER.code, name: SEEDED_RECRUITER.name, active: true },
  });
  return { created: true };
}
