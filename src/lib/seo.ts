/**
 * SEO helpers: homepage title, city landing pages, and JSON-LD.
 * JSON-LD only states facts the site already shows. No ratings, review stars, or prices.
 */
import { APP_DESCRIPTION, APP_MEANING, APP_TAGLINE } from "@/lib/brand";
import { absoluteUrl } from "@/lib/share-metadata";

/** Homepage <title>. Other pages keep the "%s · Rangach" template. */
export function homeTitle(name: string) {
  return `${name} — Luo businesses, housing & classifieds in Kenya and the Diaspora`;
}

export function homeDescription() {
  return `${APP_TAGLINE} ${APP_DESCRIPTION}`;
}

export type CityPage = {
  slug: string;
  /** Matches the stored Listing.city value and TOWNS in constants.ts. */
  city: string;
  county: string;
  intro: string;
  examples: string[];
};

/** Dedicated city landing pages. Add a town here to give it a /places/<slug> page. */
export const CITY_PAGES: CityPage[] = [
  {
    slug: "kisumu",
    city: "Kisumu",
    county: "Kisumu County",
    intro: "Find Luo-owned shops, services, housing, and classifieds in Kisumu and around the lakeside.",
    examples: ["a fundi in Kisumu", "fresh tilapia and omena", "a DJ for an ayie", "rooms and houses to let"],
  },
  {
    slug: "siaya",
    city: "Siaya",
    county: "Siaya County",
    intro: "Find Luo-owned businesses, services, and classifieds in Siaya town and across Siaya County.",
    examples: ["dowry ceremony catering", "a DJ for an ayie", "a fundi for building work", "farm produce and livestock"],
  },
  {
    slug: "homa-bay",
    city: "Homa Bay",
    county: "Homa Bay County",
    intro: "Find Luo-owned shops, services, and classifieds in Homa Bay town and along the shores of Lake Victoria.",
    examples: ["fresh tilapia from the lake", "dowry ceremony catering", "a boda or transport", "rooms and plots"],
  },
];

export function cityPage(slug: string) {
  return CITY_PAGES.find((page) => page.slug === slug) ?? null;
}

export function cityPagePath(page: CityPage) {
  return `/places/${page.slug}`;
}

export function cityBrowseHref(page: CityPage) {
  return `/listings?city=${encodeURIComponent(page.slug)}`;
}

export function cityTitle(page: CityPage) {
  return `Luo businesses & classifieds in ${page.city}`;
}

export function cityDescription(page: CityPage, name: string) {
  return `${page.intro} Browse ${page.city} listings on ${name} — chat with sellers on WhatsApp.`;
}

type Json = Record<string, unknown>;

export function organizationJsonLd(origin: string, name: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(origin, "/#organization"),
    name,
    url: absoluteUrl(origin, "/"),
    logo: absoluteUrl(origin, "/logo.svg"),
    description: `${APP_DESCRIPTION} ${name} is ${APP_MEANING}.`,
    areaServed: ["Kenya", "East Africa", "United Kingdom"],
  };
}

export function websiteJsonLd(origin: string, name: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl(origin, "/#website"),
    name,
    url: absoluteUrl(origin, "/"),
    description: homeDescription(),
    inLanguage: "en",
    publisher: { "@id": absoluteUrl(origin, "/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(origin, "/listings")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** A list of public listing pages. Names and URLs only. */
export function itemListJsonLd(origin: string, name: string, items: { id: string; title: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: absoluteUrl(origin, `/listings/${encodeURIComponent(item.id)}`),
    })),
  };
}

export function cityPageJsonLd(origin: string, name: string, page: CityPage, items: { id: string; title: string }[]): Json[] {
  const url = absoluteUrl(origin, cityPagePath(page));
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: cityTitle(page),
      description: cityDescription(page, name),
      isPartOf: { "@id": absoluteUrl(origin, "/#website") },
      about: {
        "@type": "City",
        name: page.city,
        containedInPlace: { "@type": "AdministrativeArea", name: page.county, containedInPlace: { "@type": "Country", name: "Kenya" } },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name, item: absoluteUrl(origin, "/") },
        { "@type": "ListItem", position: 2, name: page.city, item: url },
      ],
    },
    ...(items.length ? [itemListJsonLd(origin, `Listings in ${page.city}`, items)] : []),
  ];
}

/** Safe inside a <script> tag: no closing tags or HTML comments can break out. */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
