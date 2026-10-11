import { isPublicDemoHidden } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canViewSticker, recordStickerVisit, type StickerScanInput } from "@/lib/sticker";

export async function loadStickerShop(slug: string) {
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      published: true,
      hidden: true,
      userId: true,
      stickerScans: true,
      user: { select: { name: true, email: true, suspended: true } },
    },
  });
  if (!shop) return null;
  const viewer = await getSessionUser();
  const allowed = canViewSticker({
    published: shop.published,
    publiclyHidden: isPublicDemoHidden(shop.user.email),
    shopHidden: shop.hidden,
    ownerSuspended: shop.user.suspended,
    isOwner: viewer?.id === shop.userId,
    isAdmin: viewer?.role === "admin",
  });
  if (!allowed) return null;
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.user.name.trim() || "Shop",
    published: shop.published,
    stickerScans: shop.stickerScans,
  };
}

export function countStickerScan(input: StickerScanInput) {
  return recordStickerVisit(
    {
      async increment(storefrontId) {
        await prisma.storefront.update({
          where: { id: storefrontId },
          data: { stickerScans: { increment: 1 } },
        });
      },
    },
    input,
  );
}
