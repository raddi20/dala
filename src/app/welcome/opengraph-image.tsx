import { appName } from "@/lib/brand";
import { WELCOME_TITLE } from "@/lib/launch-pages";
import { renderOgCard } from "@/lib/og-card";
import { pageOgModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

export const alt = "Learn about Rangach";
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = OG_IMAGE.contentType;

export default function WelcomeImage() {
  return renderOgCard(pageOgModel(appName(), WELCOME_TITLE, "The gateway to the Luo home"));
}
