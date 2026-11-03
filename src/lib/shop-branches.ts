/**
 * Multi-branch shops. A shop (Storefront) has one or more branches, each with its own
 * town, address, phone and optional opening hours. Listings and offerings stay on the
 * shop, so a shop with three branches still shows each listing once.
 *
 * Shops saved before branches existed have no ShopBranch rows. Until the backfill runs,
 * effectiveBranches() reads the owner's town (User.city) and phone as the one branch.
 */
import type { Prisma } from "@prisma/client";
import { canonicalCity } from "@/lib/constants";
import { countryForCity, parsePhone } from "@/lib/phone";

export const MAX_BRANCHES = 20;
export const BRANCH_ADDRESS_MAX = 160;
export const BRANCH_HOURS_MAX = 120;

export type BranchInput = { id?: string; town: string; address?: string; phone?: string; hours?: string };
export type ShopBranchData = { id: string; town: string; address: string; phone: string; hours: string; sortOrder: number };
export type CleanBranch = { id?: string; town: string; address: string; phone: string; hours: string; sortOrder: number };

export type BranchValidation = { ok: true; branches: CleanBranch[] } | { ok: false; error: string };

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Checks a full branch list from the shop settings editor. At least one branch is required. */
export function validateBranches(input: unknown): BranchValidation {
  if (!Array.isArray(input)) return { ok: false, error: "Add at least one branch." };
  if (input.length === 0) return { ok: false, error: "A shop needs at least one branch." };
  if (input.length > MAX_BRANCHES) return { ok: false, error: `A shop can have up to ${MAX_BRANCHES} branches.` };
  const out: CleanBranch[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of input.entries()) {
    const label = `Branch ${index + 1}`;
    const row = (raw ?? {}) as Record<string, unknown>;
    const town = canonicalCity(oneLine(row.town));
    if (!town) return { ok: false, error: `${label}: choose a town from the list.` };
    const address = oneLine(row.address);
    if (address.length > BRANCH_ADDRESS_MAX) {
      return { ok: false, error: `${label}: keep the address under ${BRANCH_ADDRESS_MAX} characters.` };
    }
    const hours = oneLine(row.hours);
    if (hours.length > BRANCH_HOURS_MAX) {
      return { ok: false, error: `${label}: keep opening hours under ${BRANCH_HOURS_MAX} characters.` };
    }
    let phone = "";
    const rawPhone = oneLine(row.phone);
    if (rawPhone) {
      const parsed = parsePhone(rawPhone, countryForCity(town));
      if (!parsed.ok) return { ok: false, error: `${label}: ${parsed.error}` };
      phone = parsed.e164;
    }
    const key = `${town.toLowerCase()}|${address.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: `${label} repeats another branch. Give it a different town or address.` };
    seen.add(key);
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : undefined;
    out.push({ ...(id ? { id } : {}), town, address, phone, hours, sortOrder: index });
  }
  return { ok: true, branches: out };
}

/** Parses the editor's hidden JSON field. */
export function parseBranchesField(raw: FormDataEntryValue | null): BranchValidation {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Add at least one branch." };
  try {
    return validateBranches(JSON.parse(raw));
  } catch {
    return { ok: false, error: "The branch list could not be read. Reload the page and try again." };
  }
}

/** Saved branches in order, or the legacy single town when none are saved yet. */
export function effectiveBranches(shop: {
  branches?: ShopBranchData[] | null;
  user: { city: string; phone?: string };
}): ShopBranchData[] {
  const saved = [...(shop.branches ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  if (saved.length > 0) return saved;
  const town = canonicalCity(shop.user.city) || shop.user.city;
  if (!town) return [];
  return [{ id: "legacy", town, address: "", phone: shop.user.phone ?? "", hours: "", sortOrder: 0 }];
}

/** Distinct towns across branches, main town first. */
export function branchTowns(branches: { town: string }[]): string[] {
  return [...new Set(branches.map((branch) => branch.town).filter(Boolean))];
}

/**
 * Rows the one-off backfill creates: one first branch per shop that has none,
 * copied from the owner's current town and phone. Shops that already have a branch are skipped,
 * so running it twice creates nothing new.
 */
export function backfillBranchRows(
  shops: { id: string; branchCount: number; user: { city: string; phone: string } }[],
): { storefrontId: string; town: string; address: string; phone: string; hours: string; sortOrder: number }[] {
  return shops
    .filter((shop) => shop.branchCount === 0)
    .map((shop) => ({
      storefrontId: shop.id,
      town: canonicalCity(shop.user.city) || shop.user.city.trim() || "Nairobi",
      address: "",
      phone: shop.user.phone.trim(),
      hours: "",
      sortOrder: 0,
    }));
}

type BackfillClient = {
  storefront: {
    findMany(args: {
      select: { id: true; user: { select: { city: true; phone: true } }; _count: { select: { branches: true } } };
    }): Promise<{ id: string; user: { city: string; phone: string }; _count: { branches: number } }[]>;
  };
  shopBranch: { createMany(args: { data: ReturnType<typeof backfillBranchRows> }): Promise<{ count: number }> };
};

export async function backfillShopBranches(db: BackfillClient): Promise<number> {
  const shops = await db.storefront.findMany({
    select: { id: true, user: { select: { city: true, phone: true } }, _count: { select: { branches: true } } },
  });
  const rows = backfillBranchRows(shops.map((shop) => ({ id: shop.id, branchCount: shop._count.branches, user: shop.user })));
  if (rows.length === 0) return 0;
  const result = await db.shopBranch.createMany({ data: rows });
  return result.count;
}

/**
 * Plan for saving an edited list: rows to update (id belongs to this shop), rows to create,
 * and ids to delete. Ids from another shop are treated as new rows, never updated.
 */
export function branchSavePlan(existingIds: string[], next: CleanBranch[]) {
  const owned = new Set(existingIds);
  const update = next.filter((branch) => branch.id && owned.has(branch.id));
  const create = next.filter((branch) => !branch.id || !owned.has(branch.id));
  const keep = new Set(update.map((branch) => branch.id));
  const remove = existingIds.filter((id) => !keep.has(id));
  return { update, create, remove };
}

/** Storefront clause: any branch of the shop is in this town. */
export function branchTownWhere(contains: Prisma.StringFilter): Prisma.StorefrontWhereInput {
  return { branches: { some: { town: contains } } };
}

/** Listings for a shop page, once each, whatever the number of branches. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/** Card place text: "Kisumu" or "Kisumu +2 towns" for a shop with branches elsewhere. */
export function branchPlaceSuffix(towns: string[] | undefined): string {
  const extra = (towns?.length ?? 0) - 1;
  if (extra <= 0) return "";
  return ` +${extra} town${extra === 1 ? "" : "s"}`;
}
