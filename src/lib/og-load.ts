import { appName } from "@/lib/brand";
import { isCategory } from "@/lib/categories";
import { brandOgModel, categoryOgModel, listingOgModel, occasionOgModel, shopOgModel } from "@/lib/og-model";
import { prisma } from "@/lib/prisma";
import { shopSignals } from "@/lib/storefront";

export async function loadShopOg(slug: string) {
  const brand = appName();
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    select: {
      published: true,
      bannerUrl: true,
      userId: true,
      user: { select: { name: true, city: true, avatarUrl: true, verifiedPro: true } },
    },
  });
  if (!shop?.published) return brandOgModel(brand);
  const signals = await shopSignals(shop.userId);
  return shopOgModel({
    brand,
    published: true,
    name: shop.user.name,
    city: shop.user.city,
    category: signals.category,
    coverUrl: shop.bannerUrl,
    logoUrl: shop.user.avatarUrl,
    verifiedPro: shop.user.verifiedPro,
  });
}

export async function loadListingOg(id: string) {
  const brand = appName();
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, city: true, category: true, hidden: true, photoUrl: true },
  });
  if (!listing || listing.hidden) return brandOgModel(brand);
  return listingOgModel({
    brand,
    hidden: false,
    title: listing.title,
    city: listing.city,
    category: listing.category,
    photoUrl: listing.photoUrl,
  });
}

export async function loadOccasionOg(slug: string) {
  const brand = appName();
  const occasion = await prisma.occasion.findUnique({
    where: { slug },
    select: { title: true, intro: true },
  });
  if (!occasion) return brandOgModel(brand);
  return occasionOgModel(brand, occasion.title, occasion.intro);
}

export function loadCategoryOg(name: string) {
  const brand = appName();
  let category = name;
  try {
    category = decodeURIComponent(name);
  } catch {
    return null;
  }
  if (!isCategory(category)) return null;
  return categoryOgModel(brand, category);
}
