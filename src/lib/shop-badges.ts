import type { Prisma } from "@prisma/client";

/** Paid plan chip. Not a verification badge. */
export const PRO_PLAN_LABEL = "Pro plan";
export const PRO_PLAN_EXPLANATION =
  "Paid plan for 30 days: cover banner, shop video, and up to 20 offerings. This is not a verification badge.";

export const SHOP_BADGE_NOTE_MAX = 280;

export const SHOP_BADGES = [
  {
    key: "phone",
    field: "phoneVerified",
    label: "Phone verified",
    explanation: "An admin confirmed the phone number on this shop.",
  },
  {
    key: "location",
    field: "locationVerified",
    label: "Location verified",
    explanation: "An admin confirmed where this shop is.",
  },
  {
    key: "business",
    field: "businessVerified",
    label: "Business verified",
    explanation: "An admin confirmed this is a real business.",
  },
] as const;

export type ShopBadgeKey = (typeof SHOP_BADGES)[number]["key"];
export type ShopBadgeField = (typeof SHOP_BADGES)[number]["field"];
export type ShopBadgeAction = "grant" | "remove";

export const SHOP_BADGE_METHODS = [
  { key: "call", label: "Call", phrase: "call" },
  { key: "video", label: "Video", phrase: "video" },
  { key: "visit", label: "Visit", phrase: "visit" },
  {
    key: "documents",
    label: "Documents seen",
    phrase: "documents seen",
  },
] as const;

export type ShopBadgeMethod = (typeof SHOP_BADGE_METHODS)[number]["key"];

export const DOCUMENTS_SEEN_NOTE =
  "Documents seen means the admin looked at them. Nothing is uploaded or stored.";

export type ShopBadgeFlags = Record<ShopBadgeField, boolean>;

export const SHOP_BADGE_FILTERS = [
  { value: "any", label: "Any shop badge" },
  { value: "phone", label: "Phone verified" },
  { value: "location", label: "Location verified" },
  { value: "business", label: "Business verified" },
] as const;

export type ShopBadgeFilter = (typeof SHOP_BADGE_FILTERS)[number]["value"];

export type ShopBadgeAdmin = {
  id: string;
  email: string;
  name: string;
};

export type ShopBadgeUpdate =
  | { phoneVerified: boolean }
  | { locationVerified: boolean }
  | { businessVerified: boolean };

export type PlannedShopBadgeEvent = {
  storefrontId: string;
  badge: ShopBadgeKey;
  action: ShopBadgeAction;
  method: string;
  note: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  createdAt: Date;
};

export type ShopBadgeGrantRecord = {
  badge: string;
  action: string;
  method: string;
  createdAt: Date;
};

export type ShopBadgePlan =
  | { ok: false; code: "forbidden" | "invalid" }
  | { ok: true; unchanged: true }
  | { ok: true; unchanged: false; data: ShopBadgeUpdate; event: PlannedShopBadgeEvent };

const EMPTY_FLAGS: ShopBadgeFlags = {
  phoneVerified: false,
  locationVerified: false,
  businessVerified: false,
};

export function shopBadgeDefinition(key: string) {
  return SHOP_BADGES.find((badge) => badge.key === key) ?? null;
}

export function readShopBadgeFlags(state: ShopBadgeFlags): ShopBadgeFlags {
  return {
    phoneVerified: state.phoneVerified,
    locationVerified: state.locationVerified,
    businessVerified: state.businessVerified,
  };
}

export function grantedShopBadges(flags: ShopBadgeFlags | null | undefined) {
  if (!flags) return [];
  return SHOP_BADGES.filter((badge) => flags[badge.field]);
}

export function shopBadgeActionWord(action: string) {
  if (action === "grant") return "granted";
  if (action === "remove") return "removed";
  return action;
}

export function parseShopBadgeMethod(value: string | null | undefined): ShopBadgeMethod | null {
  const method = value?.trim().toLowerCase() ?? "";
  return SHOP_BADGE_METHODS.some((item) => item.key === method) ? (method as ShopBadgeMethod) : null;
}

export function shopBadgeMethodLabel(value: string | null | undefined) {
  return SHOP_BADGE_METHODS.find((item) => item.key === value?.trim().toLowerCase())?.label ?? "";
}

export function shopBadgeMethodPhrase(value: string | null | undefined) {
  return SHOP_BADGE_METHODS.find((item) => item.key === value?.trim().toLowerCase())?.phrase ?? "";
}

const SHOP_BADGE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Calendar date in UTC, for example 12 Sep 2026. */
export function formatShopBadgeDate(date: Date) {
  return `${date.getUTCDate()} ${SHOP_BADGE_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function shopBadgeCheckedLine(input: {
  badge: string;
  createdAt?: Date | null;
  method?: string | null;
}) {
  const defined = shopBadgeDefinition(input.badge);
  if (!defined) return "";
  const name = defined.label.replace(/ verified$/, "");
  const method = shopBadgeMethodPhrase(input.method);
  const date = input.createdAt ? formatShopBadgeDate(input.createdAt) : "";
  if (date && method) return `${name} checked ${date} by ${method}`;
  if (method) return `${name} checked by ${method}`;
  if (date) return `${name} checked ${date}`;
  return "";
}

/** Latest grant for a badge. A later removal does not erase that grant row. */
export function latestShopBadgeGrant(events: ShopBadgeGrantRecord[], badge: string) {
  let latest: ShopBadgeGrantRecord | null = null;
  for (const event of events) {
    if (event.action !== "grant" || event.badge !== badge) continue;
    if (!latest || event.createdAt.getTime() >= latest.createdAt.getTime()) latest = event;
  }
  return latest;
}

export function parseShopBadgeFilter(value: string | null | undefined): ShopBadgeFilter | null {
  const filter = value?.trim() ?? "";
  if (filter === "any" || filter === "phone" || filter === "location" || filter === "business") return filter;
  return null;
}

export function shopBadgeWhere(value: string | null | undefined): Prisma.ListingWhereInput | null {
  const filter = parseShopBadgeFilter(value);
  if (!filter) return null;
  if (filter === "any") {
    return {
      owner: {
        storefront: {
          OR: [{ phoneVerified: true }, { locationVerified: true }, { businessVerified: true }],
        },
      },
    };
  }
  const badge = shopBadgeDefinition(filter);
  if (!badge) return null;
  return { owner: { storefront: { [badge.field]: true } } };
}

function shopBadgeUpdate(badge: ShopBadgeKey, granted: boolean): ShopBadgeUpdate {
  if (badge === "phone") return { phoneVerified: granted };
  if (badge === "location") return { locationVerified: granted };
  return { businessVerified: granted };
}

/**
 * Decides a grant or removal. Only role "admin" is allowed — the same check as requireAdmin
 * after the session role is resolved. A paid Pro plan is not an input and cannot grant a badge.
 * Repeating the current state does not write an audit row.
 */
export function planShopBadgeChange(input: {
  role: string;
  state: ShopBadgeFlags;
  badge: string;
  action: string;
  method?: string;
  note: string;
  admin: ShopBadgeAdmin;
  storefrontId: string;
  now: Date;
}): ShopBadgePlan {
  if (input.role !== "admin") return { ok: false, code: "forbidden" };

  const badge = shopBadgeDefinition(input.badge.trim());
  const action = input.action === "grant" || input.action === "remove" ? input.action : null;
  const note = input.note.trim();
  const storefrontId = input.storefrontId.trim();
  const adminId = input.admin.id.trim();
  const method = action === "grant" ? parseShopBadgeMethod(input.method) : null;
  if (!badge || !action || !storefrontId || !adminId || note.length > SHOP_BADGE_NOTE_MAX) {
    return { ok: false, code: "invalid" };
  }
  if (action === "grant" && !method) return { ok: false, code: "invalid" };

  const flags = readShopBadgeFlags(input.state ?? EMPTY_FLAGS);
  const granted = action === "grant";
  if (flags[badge.field] === granted) return { ok: true, unchanged: true };

  return {
    ok: true,
    unchanged: false,
    data: shopBadgeUpdate(badge.key, granted),
    event: {
      storefrontId,
      badge: badge.key,
      action,
      method: method ?? "",
      note,
      adminId,
      adminEmail: input.admin.email.trim(),
      adminName: input.admin.name.trim(),
      createdAt: input.now,
    },
  };
}
