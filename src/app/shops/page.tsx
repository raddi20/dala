import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ShopsDirectory } from "@/components/shops-directory";
import { visitorActorHash } from "@/lib/ai/actor";
import { interpretSearch } from "@/lib/ai/search-parse";
import { AUDIENCE_LINE, appName } from "@/lib/brand";
import { wantsDiasporaOrders } from "@/lib/diaspora";
import { publicOrigin } from "@/lib/payments/origin";
import { browsePage, searchShops } from "@/lib/search";
import { buildShareMetadata } from "@/lib/share-metadata";
import { getSessionUser } from "@/lib/session";
import { chipBag, understoodChips } from "@/lib/understood-chips";
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
  const nlRaw = one(sp.nl).trim();
  const explicitQ = one(sp.q).trim();
  const jar = await cookies();
  const actorHash = visitorActorHash(jar.get("rangach_visitor")?.value ?? "") ?? undefined;
  const parsed = nlRaw ? await interpretSearch(nlRaw, { actorHash }) : null;
  const filters = {
    q: explicitQ,
    city: one(sp.city) || parsed?.city || "",
    region: one(sp.region) || parsed?.region || "",
    category: one(sp.category) || parsed?.category || "",
    verified: one(sp.verified) === "1" || parsed?.verified === true,
    diaspora: wantsDiasporaOrders(one(sp.diaspora)),
    occasion: one(sp.occasion) || parsed?.occasion || "",
    page: browsePage(one(sp.page)),
  };
  const user = await getSessionUser();
  const result = await searchShops({ ...filters, viewerId: user?.id });
  const bag = chipBag({ ...filters, nl: nlRaw });
  return (
    <ShopsDirectory
      shops={result.shops}
      query={filters.q}
      category={filters.category}
      region={filters.region}
      city={filters.city}
      verified={filters.verified}
      diaspora={filters.diaspora}
      occasion={filters.occasion}
      nl={nlRaw}
      page={result.page}
      pageCount={result.pageCount}
      total={result.total}
      understood={
        parsed
          ? {
              chips: understoodChips("/shops", bag, parsed.hints),
              spark: parsed.assist === "smart",
              assist: parsed.assist,
              droppedWords: false,
            }
          : null
      }
    />
  );
}
