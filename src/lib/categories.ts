/**
 * Directory categories.
 *
 * The original twelve names are unchanged so existing /listings?category= links
 * keep working. Later names are extra ways to browse. They are not a database
 * table and seeding does not rewrite listings.
 */

export const ORIGINAL_CATEGORIES = [
  "Food & restaurants",
  "Professional services",
  "Beauty & personal care",
  "Construction & trades",
  "Transport & logistics",
  "Education & tutoring",
  "Events & entertainment",
  "Real estate / housing",
  "Auto & mechanics",
  "Faith & community orgs",
  "Retail / shops",
  "Health & wellness",
] as const;

export type OriginalCategory = (typeof ORIGINAL_CATEGORIES)[number];

/** The short set on the home page. Same names and order as before. */
export const HOME_CATEGORIES: readonly OriginalCategory[] = ORIGINAL_CATEGORIES;

export const CATEGORY_GROUPS = [
  {
    id: "food",
    title: "Food",
    blurb: "Meals, markets, and trays for a gathering.",
    categories: ["Food & restaurants", "Catering", "Groceries & produce", "Butchery & fish"],
  },
  {
    id: "shopping",
    title: "Shopping",
    blurb: "Shops, clothes, and things for the house.",
    categories: [
      "Retail / shops",
      "Fashion & clothing",
      "Mitumba & second-hand",
      "Electronics & phones",
      "Home & furniture",
    ],
  },
  {
    id: "trades",
    title: "Trades & home",
    blurb: "Building, fixing, and keeping a home.",
    categories: [
      "Construction & trades",
      "Plumbing & electrical",
      "Cleaning & housekeeping",
      "Tailoring & alterations",
    ],
  },
  {
    id: "transport",
    title: "Transport",
    blurb: "Getting around Nairobi, Kenya and the Diaspora, and parcels between them.",
    categories: [
      "Transport & logistics",
      "Auto & mechanics",
      "Taxis & car hire",
      "Driving lessons",
      "Shipping & parcels",
    ],
  },
  {
    id: "housing",
    title: "Housing",
    blurb: "Rooms, short stays, and land.",
    categories: ["Real estate / housing", "Short stays", "Land & plots"],
  },
  {
    id: "care",
    title: "Care & learning",
    blurb: "Health, appearance, children, and lessons.",
    categories: [
      "Beauty & personal care",
      "Health & wellness",
      "Education & tutoring",
      "Childcare",
      "Pharmacies",
    ],
  },
  {
    id: "work",
    title: "Work & money",
    blurb: "Paperwork, money sent home, and the professions.",
    categories: ["Professional services", "Money transfer", "Printing & design", "Legal & immigration"],
  },
  {
    id: "community",
    title: "Community & occasions",
    blurb: "Churches, weddings, funerals, and the people who set them up.",
    categories: [
      "Faith & community orgs",
      "Events & entertainment",
      "Weddings & ceremonies",
      "Funerals & memorials",
      "Photography & video",
      "Music & DJs",
      "Tents, chairs & décor",
    ],
  },
  {
    id: "more",
    title: "More",
    blurb: "Farms, travel, and sport.",
    categories: ["Agriculture & farming", "Travel & tickets", "Sports & fitness"],
  },
] as const;

export type Category = (typeof CATEGORY_GROUPS)[number]["categories"][number];

export const CATEGORIES: readonly Category[] = CATEGORY_GROUPS.flatMap((group) => [...group.categories]);

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

export function isCategory(value: string): value is Category {
  return CATEGORY_SET.has(value);
}

/** Existing browse URL. Do not replace this with a new path. */
export function categoryHref(category: string) {
  return `/listings?category=${encodeURIComponent(category)}`;
}

export function categoryGroup(category: string) {
  return CATEGORY_GROUPS.find((group) => (group.categories as readonly string[]).includes(category)) ?? null;
}
