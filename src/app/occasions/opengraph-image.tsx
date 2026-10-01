import { appName } from "@/lib/brand";
import { renderOgCard } from "@/lib/og-card";
import { pageOgModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

export const alt = "Occasions on Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default function OccasionsImage() {
  return renderOgCard(pageOgModel(appName(), "Occasions", "Homecomings, weddings, and Christmas at home"));
}
