import { AUDIENCE_LINE, appName } from "@/lib/brand";
import { renderOgCard } from "@/lib/og-card";
import { pageOgModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

export const alt = "Categories on Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default function CategoriesImage() {
  return renderOgCard(pageOgModel(appName(), "Categories", `Every category, ${AUDIENCE_LINE}`));
}
