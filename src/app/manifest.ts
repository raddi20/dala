import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_TAGLINE, appName } from "@/lib/brand";
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR, pwaNames } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  const { name, shortName } = pwaNames(appName());
  return {
    id: "/",
    name,
    short_name: shortName,
    description: `${APP_TAGLINE} ${APP_DESCRIPTION}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
