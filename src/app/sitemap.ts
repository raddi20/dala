import type { MetadataRoute } from "next";
import { hiddenDemoUserFilter, publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { buildSitemap } from "@/lib/sitemap-entries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await publicOrigin();
  const demoUser = hiddenDemoUserFilter();
  const [shops, listings, people, occasions] = await Promise.all([
    prisma.storefront.findMany({
      where: publicShopWhere({ published: true }),
      select: { slug: true, updatedAt: true },
    }),
    prisma.listing.findMany({
      where: publicListingWhere({ hidden: false }),
      select: { id: true, updatedAt: true },
    }),
    prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [{ listings: { some: { hidden: false } } }, { storefront: { is: { published: true } } }],
          },
          ...(demoUser ? [demoUser] : []),
        ],
      },
      select: { id: true, updatedAt: true },
    }),
    prisma.occasion.findMany({
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return buildSitemap({ origin, shops, listings, people, occasions });
}
