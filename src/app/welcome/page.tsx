import type { Metadata } from "next";
import { WelcomeGuide } from "@/components/welcome-guide";
import { appName } from "@/lib/brand";
import { WELCOME_DESCRIPTION, WELCOME_PATH, WELCOME_TITLE } from "@/lib/launch-pages";
import { publicOrigin } from "@/lib/payments/origin";
import { buildShareMetadata } from "@/lib/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const name = appName();
  return buildShareMetadata({
    origin,
    path: WELCOME_PATH,
    title: WELCOME_TITLE,
    description: WELCOME_DESCRIPTION,
    image: "/welcome/opengraph-image",
    imageAlt: `${WELCOME_TITLE} on ${name}`,
  });
}

export default function WelcomePage() {
  return <WelcomeGuide />;
}
