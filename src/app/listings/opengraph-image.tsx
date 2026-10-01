import { appName } from "@/lib/brand";
import { renderOgCard } from "@/lib/og-card";
import { pageOgModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

export const alt = "Browse Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default function ListingsImage() {
  return renderOgCard(pageOgModel(appName(), "Browse", "Shops and classifieds in Nairobi and London"));
}
