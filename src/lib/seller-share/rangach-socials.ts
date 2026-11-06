/**
 * Official Rangach socials for brand visibility on seller share captions and tip cards.
 * No prior site config held these handles; @rangachke is the public brand handle.
 */

export const RANGACH_SOCIALS = {
  instagram: { handle: "@rangachke", url: "https://www.instagram.com/rangachke" },
  x: { handle: "@rangachke", url: "https://x.com/rangachke" },
  tiktok: { handle: "@rangachke", url: "https://www.tiktok.com/@rangachke" },
  facebook: { handle: "Rangach", url: "https://www.facebook.com/rangachke" },
} as const;

export type RangachSocialKey = keyof typeof RANGACH_SOCIALS;

export function rangachSocialLine(): string {
  return `Follow Rangach: Instagram ${RANGACH_SOCIALS.instagram.handle}, X ${RANGACH_SOCIALS.x.handle}, TikTok ${RANGACH_SOCIALS.tiktok.handle}, Facebook ${RANGACH_SOCIALS.facebook.url}`;
}
