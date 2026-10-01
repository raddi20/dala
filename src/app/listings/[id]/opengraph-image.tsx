import { OG_IMAGE } from "@/lib/share-metadata";
import { loadListingOg } from "@/lib/og-load";
import { renderOgCard } from "@/lib/og-card";

export const alt = "Listing on Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default async function ListingImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderOgCard(await loadListingOg(id));
}
