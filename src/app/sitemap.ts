import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { buildSitemap } from "@/lib/sitemap-entries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await publicOrigin();
  const [shops, listings, people] = await Promise.all([
    prisma.storefront.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.listing.findMany({
      where: { hidden: false },
      select: { id: true, updatedAt: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [{ listings: { some: { hidden: false } } }, { storefront: { is: { published: true } } }],
      },
      select: { id: true, updatedAt: true },
    }),
  ]);
  return buildSitemap({ origin, shops, listings, people });
}
