import { appName } from "@/lib/brand";
import { renderOgCard } from "@/lib/og-card";
import { pageOgModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

export const alt = "Pricing on Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default function PricingImage() {
  return renderOgCard(pageOgModel(appName(), "Pricing", "Featured and Verified Pro"));
}
