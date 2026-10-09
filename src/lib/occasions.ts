import { Prisma, type PrismaClient } from "@prisma/client";

export const OCCASION_INTRO_MAX = 1500;
export const OCCASION_TITLE_MAX = 80;

/**
 * Definitions inserted only when the slug is missing.
 * Homecomings, ayie, funerals, and Christmas are the diaspora-funded moments in the market report.
 * A house back home is the other clear one: money from the Diaspora often goes into a build in Nairobi or Piny Luo.
 */
export const OCCASION_DEFINITIONS = [
  {
    slug: "homecomings",
    title: "Homecomings",
    sortOrder: 10,
    intro:
      "Someone is flying in from the Diaspora, or travelling from Nairobi down to the village. The household needs food, a vehicle, and a bed for that week. These shops and listings are the ones sellers have marked for the visit. You arrange it on WhatsApp.",
  },
  {
    slug: "weddings-dowry",
    title: "Weddings & dowry (ayie)",
    sortOrder: 20,
    intro:
      "Ayie, the wedding day, and the guests who travel for both. Catering, clothes, a hall, cars, and photos. Message the seller on WhatsApp. Rangach does not take the payment.",
  },
  {
    slug: "funerals",
    title: "Funerals",
    sortOrder: 30,
    intro:
      "Tents, chairs, food, and transport for when the family gathers. A named shop is easier to trust than a number passed around a group chat. Payment stays between you and the seller.",
  },
  {
    slug: "christmas-at-home",
    title: "Christmas at home",
    sortOrder: 40,
    intro:
      "December is when many people in Kenya, East Africa and the Diaspora send food, gifts, and fare for the visit home. These sellers have said they can help with that week. Chat on WhatsApp to arrange it.",
  },
  {
    slug: "house-back-home",
    title: "A house back home",
    sortOrder: 50,
    intro:
      "Money from abroad often goes into a house, in Nairobi or further out in Kisumu, Siaya, Homa Bay, Migori, or Bondo. Builders, fundis, furniture, and someone to move it. You still agree the work on WhatsApp.",
  },
] as const;

export type OccasionSlug = (typeof OCCASION_DEFINITIONS)[number]["slug"];

export type OccasionDefinition = {
  slug: string;
  title: string;
  intro: string;
  sortOrder: number;
};

export function occasionDefinition(slug: string) {
  return OCCASION_DEFINITIONS.find((item) => item.slug === slug) ?? null;
}

type OccasionWriter = Pick<PrismaClient, "occasion">;

/**
 * Previous default intros. An occasion row that still has one of these is
 * updated to the current definition. Any other saved intro is left alone.
 */
const PREVIOUS_OCCASION_INTROS: Record<string, readonly string[]> = {
  homecomings: [
    "Someone is flying in from London, or travelling from Nairobi down to the village. The household needs food, a vehicle, and a bed for that week. These shops and listings are the ones sellers have marked for the visit. You arrange it on WhatsApp.",
  ],
  "christmas-at-home": [
    "December is when many people in London and Nairobi send food, gifts, and fare for the visit home. These sellers have said they can help with that week. Chat on WhatsApp to arrange it.",
    "December is when many people in Nairobi, Kenya and the Diaspora send food, gifts, and fare for the visit home. These sellers have said they can help with that week. Chat on WhatsApp to arrange it.",
  ],
};

/**
 * Create occasion rows that are not in the database yet.
 * Existing title, intro, and sort order are left as the admin saved them,
 * except an intro that is still the previous default sentence.
 */
export async function ensureOccasionDefinitions(
  db: OccasionWriter,
  definitions: readonly OccasionDefinition[] = OCCASION_DEFINITIONS,
) {
  const slugs = definitions.map((item) => item.slug);
  const existing = await db.occasion.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, intro: true },
  });
  const have = new Set(existing.map((row) => row.slug));
  const missing = definitions.filter((item) => !have.has(item.slug));
  const created: string[] = [];
  const updated: string[] = [];
  for (const item of missing) {
    try {
      await db.occasion.create({
        data: {
          slug: item.slug,
          title: item.title,
          intro: item.intro,
          sortOrder: item.sortOrder,
        },
      });
      created.push(item.slug);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  for (const row of existing) {
    const previous = PREVIOUS_OCCASION_INTROS[row.slug] ?? [];
    const next = definitions.find((item) => item.slug === row.slug);
    if (!next || !previous.includes(row.intro) || next.intro === row.intro) continue;
    await db.occasion.update({ where: { slug: row.slug }, data: { intro: next.intro } });
    updated.push(row.slug);
  }
  return { created, updated };
}

const tagSelect = { id: true, slug: true } satisfies Prisma.OccasionSelect;

/** Keep the seller's tags for this shop. Pins on tags they leave ticked stay put. */
export async function syncShopOccasionSlugs(db: PrismaClient, storefrontId: string, slugs: string[]) {
  const wanted = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  const occasions = await db.occasion.findMany({
    where: { slug: { in: wanted } },
    select: tagSelect,
  });
  const wantedIds = new Set(occasions.map((item) => item.id));
  const current = await db.shopOccasion.findMany({ where: { storefrontId }, select: { id: true, occasionId: true } });
  const have = new Set(current.map((row) => row.occasionId));
  const remove = current.filter((row) => !wantedIds.has(row.occasionId));
  if (remove.length > 0) {
    await db.shopOccasion.deleteMany({ where: { id: { in: remove.map((row) => row.id) } } });
  }
  const add = [...wantedIds].filter((id) => !have.has(id));
  if (add.length > 0) {
    await db.shopOccasion.createMany({
      data: add.map((occasionId) => ({ storefrontId, occasionId })),
    });
  }
}

/** Keep the seller's tags for this listing. Pins on tags they leave ticked stay put. */
export async function syncListingOccasionSlugs(db: PrismaClient, listingId: string, slugs: string[]) {
  const wanted = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  const occasions = await db.occasion.findMany({
    where: { slug: { in: wanted } },
    select: tagSelect,
  });
  const wantedIds = new Set(occasions.map((item) => item.id));
  const current = await db.listingOccasion.findMany({ where: { listingId }, select: { id: true, occasionId: true } });
  const have = new Set(current.map((row) => row.occasionId));
  const remove = current.filter((row) => !wantedIds.has(row.occasionId));
  if (remove.length > 0) {
    await db.listingOccasion.deleteMany({ where: { id: { in: remove.map((row) => row.id) } } });
  }
  const add = [...wantedIds].filter((id) => !have.has(id));
  if (add.length > 0) {
    await db.listingOccasion.createMany({
      data: add.map((occasionId) => ({ listingId, occasionId })),
    });
  }
}
