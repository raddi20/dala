import { appName } from "@/lib/brand";
import { isCategory } from "@/lib/categories";
import { isPublicDemoHidden } from "@/lib/demo-visibility";
import { brandOgModel, categoryOgModel, listingOgModel, occasionOgModel, shopOgModel } from "@/lib/og-model";
import { prisma } from "@/lib/prisma";
import { shopSignals } from "@/lib/storefront";
import { isProActive } from "@/lib/pro";
import { shopVideoIsPublic } from "@/lib/video/machine";

export async function loadShopOg(slug: string) {
  const brand = appName();
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    select: {
      published: true,
      bannerUrl: true,
      userId: true,
      user: { select: { name: true, email: true, city: true, avatarUrl: true, verifiedPro: true, verifiedProUntil: true } },
      videos: {
        where: { status: "approved", NOT: { publicPlaybackId: "" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, publicPlaybackId: true, posterUrl: true },
      },
    },
  });
  if (!shop?.published || isPublicDemoHidden(shop.user.email)) return brandOgModel(brand);
  const signals = await shopSignals(shop.userId);
  const proActive = isProActive(shop.user);
  const video = shop.videos[0];
  const hasVideo = video
    ? shopVideoIsPublic({
        verifiedPro: proActive,
        published: true,
        status: video.status,
        publicPlaybackId: video.publicPlaybackId,
      })
    : false;
  return shopOgModel({
    brand,
    published: true,
    name: shop.user.name,
    city: shop.user.city,
    category: signals.category,
    coverUrl: shop.bannerUrl,
    logoUrl: shop.user.avatarUrl,
    verifiedPro: proActive,
    videoPosterUrl: hasVideo ? video?.posterUrl : "",
  });
}

export async function loadListingOg(id: string) {
  const brand = appName();
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      title: true,
      city: true,
      category: true,
      hidden: true,
      photoUrl: true,
      owner: { select: { email: true } },
    },
  });
  if (!listing || listing.hidden || isPublicDemoHidden(listing.owner.email)) return brandOgModel(brand);
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
