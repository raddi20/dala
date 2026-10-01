import { APP_TAGLINE } from "@/lib/brand";
import { publicImageUrl } from "@/lib/share-metadata";

export type OgCardModel = {
  brand: string;
  kicker: string;
  title: string;
  subtitle: string;
  photoUrl: string;
};

export function brandOgModel(brand: string): OgCardModel {
  return {
    brand,
    kicker: "Nairobi and London",
    title: brand,
    subtitle: APP_TAGLINE,
    photoUrl: "",
  };
}

function clipTitle(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 90) return clean;
  return `${clean.slice(0, 89).trimEnd()}…`;
}

export function shopOgModel(input: {
  brand: string;
  published: boolean;
  name: string;
  city: string;
  category: string;
  coverUrl: string;
  logoUrl: string;
  verifiedPro: boolean;
}): OgCardModel {
  if (!input.published) return brandOgModel(input.brand);
  const cover = input.verifiedPro ? publicImageUrl(input.coverUrl) : "";
  const logo = publicImageUrl(input.logoUrl);
  const place = [input.city, input.category].filter(Boolean).join(" · ");
  return {
    brand: input.brand,
    kicker: place || "Shop",
    title: clipTitle(input.name),
    subtitle: APP_TAGLINE,
    photoUrl: cover || logo,
  };
}

export function listingOgModel(input: {
  brand: string;
  hidden: boolean;
  title: string;
  city: string;
  category: string;
  photoUrl: string;
}): OgCardModel {
  if (input.hidden) return brandOgModel(input.brand);
  const place = [input.city, input.category].filter(Boolean).join(" · ");
  return {
    brand: input.brand,
    kicker: place || "Listing",
    title: clipTitle(input.title),
    subtitle: APP_TAGLINE,
    photoUrl: publicImageUrl(input.photoUrl),
  };
}

export function categoryOgModel(brand: string, category: string): OgCardModel {
  return {
    brand,
    kicker: "Category",
    title: category,
    subtitle: "Shops and classifieds in Nairobi and London",
    photoUrl: "",
  };
}

export function occasionOgModel(brand: string, title: string, intro: string): OgCardModel {
  const subtitle = clipTitle(intro) || "Shops and listings for family at home";
  return {
    brand,
    kicker: "Occasion",
    title: clipTitle(title),
    subtitle,
    photoUrl: "",
  };
}

export function pageOgModel(brand: string, title: string, subtitle: string): OgCardModel {
  return {
    brand,
    kicker: "Nairobi and London",
    title,
    subtitle,
    photoUrl: "",
  };
}
