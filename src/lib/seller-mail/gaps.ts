export type ShopGaps = {
  missingCover: boolean;
  missingPhotos: number;
  fewListings: boolean;
  listingCount: number;
  thinAbout: boolean;
  missingHours: boolean;
  missingPhone: boolean;
  missingSocialHandles: boolean;
  remindShare: boolean;
};

export type GapTip = { title: string; body: string };

const FEW_LISTINGS = 3;
const THIN_ABOUT = 40;

export function shopLooksComplete(gaps: ShopGaps): boolean {
  return (
    !gaps.missingCover &&
    gaps.missingPhotos === 0 &&
    !gaps.fewListings &&
    !gaps.thinAbout &&
    !gaps.missingHours &&
    !gaps.missingPhone
  );
}

export function computeShopGaps(input: {
  bannerUrl: string;
  bio: string;
  phone: string;
  whatsapp: string;
  offerings: { imageUrl: string }[];
  listings: { photoUrl: string }[];
  branches: { hours: string; phone: string }[];
  hasSocialHandle: boolean;
}): ShopGaps {
  const offerings = input.offerings;
  const listings = input.listings;
  const listingCount = offerings.length + listings.length;
  const missingOfferingPhotos = offerings.filter((row) => !row.imageUrl.trim()).length;
  const missingListingPhotos = listings.filter((row) => !row.photoUrl.trim()).length;
  const missingPhotos = missingOfferingPhotos + missingListingPhotos;
  const phone = (input.whatsapp || input.phone || "").trim();
  const branchPhone = input.branches.some((branch) => branch.phone.trim());
  const hours = input.branches.some((branch) => branch.hours.trim());
  // Shops with no branch rows yet: treat hours as missing so we nudge them to add hours.
  const missingHours = input.branches.length === 0 ? true : !hours;
  return {
    missingCover: !input.bannerUrl.trim(),
    missingPhotos,
    fewListings: listingCount < FEW_LISTINGS,
    listingCount,
    thinAbout: input.bio.trim().length < THIN_ABOUT,
    missingHours,
    missingPhone: !phone && !branchPhone,
    missingSocialHandles: !input.hasSocialHandle,
    remindShare: true,
  };
}

export function gapTips(gaps: ShopGaps): GapTip[] {
  const tips: GapTip[] = [];
  if (gaps.missingCover) {
    tips.push({ title: "Add a cover photo", body: "A clear cover photo makes your shop feel real at a glance." });
  }
  if (gaps.missingPhotos > 0) {
    tips.push({
      title: "Add photos",
      body: `${gaps.missingPhotos} of your offerings or listings still have no photo.`,
    });
  }
  if (gaps.fewListings) {
    tips.push({
      title: "Add a few offerings",
      body: `You have ${gaps.listingCount}. Three or more gives buyers more to choose from.`,
    });
  }
  if (gaps.thinAbout) {
    tips.push({ title: "Say a bit about the shop", body: "One or two sentences on who you are helps people trust you." });
  }
  if (gaps.missingHours) {
    tips.push({ title: "Add opening hours", body: "Hours on your branch help buyers know when to call or visit." });
  }
  if (gaps.missingPhone) {
    tips.push({ title: "Add a phone or WhatsApp", body: "Buyers need a number to reach you from your shop page." });
  }
  if (gaps.missingSocialHandles) {
    tips.push({
      title: "Save your social handles",
      body: "Add Instagram, Facebook, X, or TikTok on your shop so Share can mention them.",
    });
  }
  if (gaps.remindShare || tips.length === 0) {
    tips.push({
      title: "Share your Rangach link",
      body: "Open Account → Share for ready captions and a branded card to post yourself.",
    });
  }
  return tips.slice(0, 4);
}

/** Weekly while gaps remain; monthly when the shop looks complete. Never daily. */
export function visibilityDue(input: {
  now: Date;
  lastSentAt: Date | null;
  complete: boolean;
}): boolean {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const MONTH_MS = 28 * 24 * 60 * 60 * 1000;
  if (!input.lastSentAt) return true;
  const elapsed = input.now.getTime() - input.lastSentAt.getTime();
  if (elapsed < WEEK_MS) return false;
  if (!input.complete) return elapsed >= WEEK_MS;
  return elapsed >= MONTH_MS;
}
