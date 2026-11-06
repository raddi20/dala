/**
 * Free visibility checklist for every live shop.
 * Not gated on Featured, Verified Pro, or any paid plan.
 */

import { computeShopGaps, type ShopGaps } from "@/lib/seller-mail/gaps";
import { missingHandleKeys, type SellerSocialHandles } from "@/lib/seller-share/handles";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  hint: string;
  href?: string;
};

export type ChecklistInput = {
  published: boolean;
  bannerUrl: string;
  bio: string;
  phone: string;
  whatsapp: string;
  offerings: { imageUrl: string }[];
  listings: { photoUrl: string }[];
  branches: { hours: string; phone: string }[];
  handles: SellerSocialHandles;
  /** Paid-plan flags. Kept only so tests prove they do not gate this kit. */
  featured?: boolean;
  verifiedPro?: boolean;
};

/** Always true for a published shop — the marketing kit is included, not an upgrade. */
export function marketingKitIncluded(input: {
  published: boolean;
  featured?: boolean;
  verifiedPro?: boolean;
}): boolean {
  void input.featured;
  void input.verifiedPro;
  return input.published;
}

export function buildVisibilityChecklist(input: ChecklistInput): ChecklistItem[] {
  const hasSocialHandle = Boolean(
    input.handles.instagram || input.handles.facebook || input.handles.x || input.handles.tiktok,
  );
  const gaps: ShopGaps = computeShopGaps({
    bannerUrl: input.bannerUrl,
    bio: input.bio,
    phone: input.phone,
    whatsapp: input.whatsapp,
    offerings: input.offerings,
    listings: input.listings,
    branches: input.branches,
    hasSocialHandle,
  });

  const photoDone = !gaps.missingCover && gaps.missingPhotos === 0;
  const listingsDone = !gaps.fewListings;
  const aboutHoursDone = !gaps.thinAbout && !gaps.missingHours;
  const handlesDone = missingHandleKeys(input.handles).length === 0;
  // "Share the link" stays open as a gentle nudge even when other items are done.
  const shareDone = false;

  return [
    {
      id: "photos",
      label: "Add photos",
      done: photoDone,
      hint: photoDone ? "Cover and offering photos look set." : "Add a cover and photos on your offerings or listings.",
      href: "/account/storefront#shop-settings",
    },
    {
      id: "listings",
      label: "Add listings or offerings",
      done: listingsDone,
      hint: listingsDone ? "You have enough to choose from." : "Aim for at least three offerings or listings.",
      href: "/account/storefront#add-offering",
    },
    {
      id: "about-hours",
      label: "Fill about and hours",
      done: aboutHoursDone,
      hint: aboutHoursDone ? "About and hours are filled in." : "Add a short about and opening hours on a branch.",
      href: "/account/storefront#shop-settings",
    },
    {
      id: "handles",
      label: "Save social handles",
      done: handlesDone,
      hint: handlesDone
        ? "Your handles are saved for captions."
        : "Add Instagram, Facebook, X, TikTok, and keep WhatsApp on your account.",
      href: "/account/storefront#shop-settings",
    },
    {
      id: "share",
      label: "Share your Rangach link",
      done: shareDone,
      hint: "Copy the link or open WhatsApp, then post with the Share tool.",
      href: "/account/share",
    },
  ];
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  const actionable = items.filter((item) => item.id !== "share");
  return { done: actionable.filter((item) => item.done).length, total: actionable.length };
}
