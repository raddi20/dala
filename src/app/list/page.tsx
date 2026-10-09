import type { Metadata } from "next";
import { ListGuide } from "@/components/list-guide";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { appName } from "@/lib/brand";
import { LIST_DESCRIPTION, LIST_PATH, LIST_TITLE, SIGNED_OUT_PROGRESS, type GuideProgress } from "@/lib/launch-pages";
import { publicOrigin } from "@/lib/payments/origin";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { buildShareMetadata } from "@/lib/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const name = appName();
  return buildShareMetadata({
    origin,
    path: LIST_PATH,
    title: LIST_TITLE,
    description: LIST_DESCRIPTION,
    image: "/list/opengraph-image",
    imageAlt: `${LIST_TITLE} on ${name}`,
  });
}

export default async function ListPage() {
  const user = await getSessionUser();
  const listingWriter = await isAiFeatureOn("listing_writer");
  if (!user) return <ListGuide progress={SIGNED_OUT_PROGRESS} listingWriter={listingWriter} />;

  const [shop, listings] = await Promise.all([
    prisma.storefront.findUnique({
      where: { userId: user.id },
      select: { published: true, _count: { select: { offerings: true } } },
    }),
    prisma.listing.count({ where: { ownerId: user.id } }),
  ]);

  const progress: GuideProgress = {
    signedIn: true,
    hasShop: Boolean(shop),
    hasOffering: (shop?._count.offerings ?? 0) > 0,
    shopPublished: Boolean(shop?.published),
    hasListing: listings > 0,
    hasWhatsapp: Boolean(user.whatsapp.trim() || user.phone.trim()),
  };

  return <ListGuide progress={progress} listingWriter={listingWriter} />;
}
