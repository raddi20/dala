import { OG_IMAGE } from "@/lib/share-metadata";
import { loadShopOg } from "@/lib/og-load";
import { renderOgCard } from "@/lib/og-card";

export const alt = "Shop on Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default async function ShopImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderOgCard(await loadShopOg(slug));
}
