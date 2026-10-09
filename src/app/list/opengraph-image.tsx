import { appName } from "@/lib/brand";
import { LIST_TITLE } from "@/lib/launch-pages";
import { renderOgCard } from "@/lib/og-card";
import { pageOgModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

export const alt = "List your business on Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default function ListImage() {
  return renderOgCard(pageOgModel(appName(), LIST_TITLE, "Free to list. Buyers message you on WhatsApp."));
}
