/**
 * Public brochure pages. /welcome and /list are the QR targets and must stay at these paths.
 * Step links are the pages the product already uses.
 */

export const WELCOME_PATH = "/welcome";
export const LIST_PATH = "/list";

export const WELCOME_TITLE = "Learn about Rangach";
export const WELCOME_DESCRIPTION =
  "Rangach is the gateway to the Luo home. Free for sellers, for buyers in Kenya and East Africa, and for the diaspora buying for family back home.";

export const LIST_TITLE = "List your business";
export const LIST_DESCRIPTION =
  "Create an account, open a shop, add a listing with a photo, and a WhatsApp number. Listing on Rangach is free.";

export const LAUNCH_ROUTES = {
  register: "/register",
  registerReturn: "/register?next=/list",
  account: "/account",
  shop: "/account/storefront",
  offering: "/account/storefront#add-offering",
  listing: "/listings/new",
  whatsapp: "/account#profile-whatsapp",
  video: "/account/storefront#shop-video",
  occasions: "/occasions",
} as const;

export type GuideProgress = {
  signedIn: boolean;
  hasShop: boolean;
  hasOffering: boolean;
  shopPublished: boolean;
  hasListing: boolean;
  hasWhatsapp: boolean;
};

export const SIGNED_OUT_PROGRESS: GuideProgress = {
  signedIn: false,
  hasShop: false,
  hasOffering: false,
  shopPublished: false,
  hasListing: false,
  hasWhatsapp: false,
};

export type GuideStepId = "account" | "shop" | "listing" | "whatsapp" | "video" | "live";

const REQUIRED_STEPS: GuideStepId[] = ["account", "shop", "listing", "whatsapp"];

export function guideStepDone(id: GuideStepId, progress: GuideProgress) {
  if (!progress.signedIn) return false;
  if (id === "account") return true;
  if (id === "shop") return progress.hasShop;
  if (id === "listing") return progress.hasListing;
  if (id === "whatsapp") return progress.hasWhatsapp;
  if (id === "live") return progress.shopPublished && progress.hasListing;
  return false;
}

/** Signed-out visitors have no highlighted step. Signed-in visitors get the first unfinished required step. */
export function guideCurrentStep(progress: GuideProgress): GuideStepId | null {
  if (!progress.signedIn) return null;
  const open = REQUIRED_STEPS.find((id) => !guideStepDone(id, progress));
  if (open) return open;
  if (!guideStepDone("live", progress)) return "live";
  return null;
}

export function shopStepLink(progress: GuideProgress) {
  if (progress.signedIn && progress.hasShop && !progress.hasOffering) {
    return { href: LAUNCH_ROUTES.offering, label: "Add your first offering" };
  }
  if (progress.signedIn && progress.hasShop) {
    return { href: LAUNCH_ROUTES.shop, label: "Open your shop" };
  }
  return { href: LAUNCH_ROUTES.shop, label: "Set up the shop" };
}

export function liveStepLink(progress: GuideProgress) {
  if (progress.signedIn && progress.hasShop && !progress.shopPublished) {
    return { href: LAUNCH_ROUTES.shop, label: "Publish your shop" };
  }
  if (progress.signedIn && progress.shopPublished) {
    return { href: LAUNCH_ROUTES.shop, label: "Open your shop" };
  }
  return { href: LAUNCH_ROUTES.shop, label: "Go to your shop" };
}
