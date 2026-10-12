import type { Metadata } from "next";
import { ShopsDirectory } from "@/components/shops-directory";
import { AUDIENCE_LINE, appName } from "@/lib/brand";
import { publicOrigin } from "@/lib/payments/origin";
import { browsePage, searchShops } from "@/lib/search";
import { buildShareMetadata } from "@/lib/share-metadata";
import { getSessionUser } from "@/lib/session";
import { one } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const name = appName();
  return buildShareMetadata({
    origin,
    path: "/shops",
    title: "Shops",
    description: `Published Luo shops in ${AUDIENCE_LINE} on ${name}.`,
    image: "/listings/opengraph-image",
    imageAlt: `Shops on ${name}`,
  });
}

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    q: one(sp.q).trim(),
    city: one(sp.city),
    region: one(sp.region),
    category: one(sp.category),
    verified: one(sp.verified) === "1",
    page: browsePage(one(sp.page)),
  };
  const user = await getSessionUser();
  const result = await searchShops({ ...filters, viewerId: user?.id });
  return (
    <ShopsDirectory
      shops={result.shops}
      query={filters.q}
      category={filters.category}
      region={filters.region}
      city={filters.city}
      verified={filters.verified}
      page={result.page}
      pageCount={result.pageCount}
      total={result.total}
    />
  );
}
