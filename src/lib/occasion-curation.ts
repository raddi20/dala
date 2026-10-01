import { Prisma, type PrismaClient } from "@prisma/client";
import { OCCASION_INTRO_MAX, OCCASION_TITLE_MAX } from "@/lib/occasions";

export const OCCASION_CURATION_ACTIONS = [
  "save-copy",
  "tag-shop",
  "untag-shop",
  "pin-shop",
  "unpin-shop",
  "tag-listing",
  "untag-listing",
  "pin-listing",
  "unpin-listing",
] as const;

export type OccasionCurationAction = (typeof OCCASION_CURATION_ACTIONS)[number];

export type OccasionCurationPlan =
  | { ok: false; code: "forbidden" | "invalid" }
  | {
      ok: true;
      action: OccasionCurationAction;
      occasionId: string;
      intro: string;
      title: string;
      storefrontId: string;
      listingId: string;
    };

function isAction(value: string): value is OccasionCurationAction {
  return (OCCASION_CURATION_ACTIONS as readonly string[]).includes(value);
}

/**
 * Admin-only edits: intro, title, which shops and listings appear, and which ones are pinned.
 * Role must be exactly "admin", the same check requireAdmin uses after the session is resolved.
 * Sellers tag their own shop from shop settings. That path does not come through here.
 */
export function planOccasionCuration(input: {
  role: string;
  action: string;
  occasionId: string;
  intro?: string;
  title?: string;
  storefrontId?: string;
  listingId?: string;
}): OccasionCurationPlan {
  if (input.role !== "admin") return { ok: false, code: "forbidden" };

  const action = input.action.trim();
  const occasionId = input.occasionId.trim();
  const intro = (input.intro ?? "").trim();
  const title = (input.title ?? "").trim();
  const storefrontId = (input.storefrontId ?? "").trim();
  const listingId = (input.listingId ?? "").trim();
  if (!isAction(action) || !occasionId) return { ok: false, code: "invalid" };
  if (intro.length > OCCASION_INTRO_MAX) return { ok: false, code: "invalid" };
  if (title && (title.length < 3 || title.length > OCCASION_TITLE_MAX)) return { ok: false, code: "invalid" };

  const needsShop = action.endsWith("shop");
  const needsListing = action.endsWith("listing");
  if (needsShop && !storefrontId) return { ok: false, code: "invalid" };
  if (needsListing && !listingId) return { ok: false, code: "invalid" };

  return { ok: true, action, occasionId, intro, title, storefrontId, listingId };
}

async function missingOr<T>(work: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; code: "missing" }> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return { ok: false, code: "missing" };
    }
    throw error;
  }
}

export async function commitOccasionCuration(
  db: PrismaClient,
  input: {
    role: string;
    action: string;
    occasionId: string;
    intro?: string;
    title?: string;
    storefrontId?: string;
    listingId?: string;
  },
): Promise<{ ok: true; slug: string } | { ok: false; code: "forbidden" | "invalid" | "missing" }> {
  const plan = planOccasionCuration(input);
  if (!plan.ok) return plan;

  if (plan.action === "save-copy") {
    const saved = await missingOr(() =>
      db.occasion.update({
        where: { id: plan.occasionId },
        data: {
          intro: plan.intro,
          ...(plan.title ? { title: plan.title } : {}),
        },
        select: { slug: true },
      }),
    );
    if (!saved.ok) return saved;
    return { ok: true, slug: saved.value.slug };
  }

  const occasion = await db.occasion.findUnique({ where: { id: plan.occasionId }, select: { slug: true } });
  if (!occasion) return { ok: false, code: "missing" };

  if (plan.action === "tag-shop" || plan.action === "pin-shop" || plan.action === "unpin-shop") {
    const shop = await db.storefront.findUnique({ where: { id: plan.storefrontId }, select: { id: true } });
    if (!shop) return { ok: false, code: "missing" };
    const pinned = plan.action === "pin-shop" ? true : plan.action === "unpin-shop" ? false : undefined;
    await db.shopOccasion.upsert({
      where: { occasionId_storefrontId: { occasionId: plan.occasionId, storefrontId: plan.storefrontId } },
      create: {
        occasionId: plan.occasionId,
        storefrontId: plan.storefrontId,
        pinned: pinned ?? false,
      },
      update: pinned === undefined ? {} : { pinned },
    });
    return { ok: true, slug: occasion.slug };
  }

  if (plan.action === "untag-shop") {
    await db.shopOccasion.deleteMany({
      where: { occasionId: plan.occasionId, storefrontId: plan.storefrontId },
    });
    return { ok: true, slug: occasion.slug };
  }

  if (plan.action === "tag-listing" || plan.action === "pin-listing" || plan.action === "unpin-listing") {
    const listing = await db.listing.findUnique({ where: { id: plan.listingId }, select: { id: true } });
    if (!listing) return { ok: false, code: "missing" };
    const pinned = plan.action === "pin-listing" ? true : plan.action === "unpin-listing" ? false : undefined;
    await db.listingOccasion.upsert({
      where: { occasionId_listingId: { occasionId: plan.occasionId, listingId: plan.listingId } },
      create: {
        occasionId: plan.occasionId,
        listingId: plan.listingId,
        pinned: pinned ?? false,
      },
      update: pinned === undefined ? {} : { pinned },
    });
    return { ok: true, slug: occasion.slug };
  }

  await db.listingOccasion.deleteMany({
    where: { occasionId: plan.occasionId, listingId: plan.listingId },
  });
  return { ok: true, slug: occasion.slug };
}
