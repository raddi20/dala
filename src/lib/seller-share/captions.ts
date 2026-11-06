import { rangachSocialLine } from "@/lib/seller-share/rangach-socials";
import {
  displayHandle,
  missingHandleKeys,
  profileUrl,
  sellerSocialLine,
  type SellerSocialHandles,
} from "@/lib/seller-share/handles";

export type ShareTarget = "whatsapp" | "instagram" | "facebook" | "x" | "tiktok";

export type ShareSubject = {
  kind: "shop" | "listing";
  name: string;
  /** Live Rangach URL for the shop or the listing. Required in every caption. */
  url: string;
  /** Optional on-page facts only. Never invent. */
  city?: string;
  priceLabel?: string;
  description?: string;
  photoUrl?: string;
};

export type CoachingTip = {
  id: string;
  title: string;
  body: string;
};

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function factBits(subject: ShareSubject): string[] {
  const bits: string[] = [];
  if (subject.city?.trim()) bits.push(subject.city.trim());
  if (subject.priceLabel?.trim()) bits.push(subject.priceLabel.trim());
  return bits;
}

function subjectLead(subject: ShareSubject): string {
  const bits = factBits(subject);
  const place = bits.length ? ` (${bits.join(" · ")})` : "";
  if (subject.kind === "listing") {
    return `${subject.name.trim()}${place}`;
  }
  return `${subject.name.trim()}${place}`;
}

function descriptionLine(subject: ShareSubject, max = 120): string {
  const text = subject.description?.trim() ?? "";
  if (!text) return "";
  return clip(text, max);
}

/** Every caption includes the Rangach URL, seller handles when present, and Rangach socials. */
export function buildCaption(
  target: ShareTarget,
  subject: ShareSubject,
  handles: SellerSocialHandles,
): string {
  const lead = subjectLead(subject);
  const about = descriptionLine(subject);
  const sellerLine = sellerSocialLine(handles);
  const brandLine = rangachSocialLine();
  const lines: string[] = [];

  if (target === "whatsapp") {
    lines.push(`Find ${lead} on Rangach.`);
    if (about) lines.push(about);
    lines.push(subject.url);
  } else if (target === "instagram") {
    lines.push(`${lead} is on Rangach.`);
    if (about) lines.push(about);
    lines.push(`Shop link in bio / caption: ${subject.url}`);
    if (handles.instagram) lines.push(`Our IG: ${displayHandle(handles.instagram)}`);
  } else if (target === "facebook") {
    lines.push(`${lead} — find us on Rangach.`);
    if (about) lines.push(about);
    lines.push(subject.url);
    if (handles.facebook) lines.push(`Facebook: ${profileUrl("facebook", handles.facebook)}`);
  } else if (target === "x") {
    const shortAbout = descriptionLine(subject, 80);
    lines.push(`${lead} on Rangach ${subject.url}`);
    if (shortAbout) lines.push(shortAbout);
    if (handles.x) lines.push(displayHandle(handles.x));
  } else {
    lines.push(`${lead} on Rangach.`);
    if (about) lines.push(about);
    lines.push(`Link: ${subject.url}`);
    if (handles.tiktok) lines.push(displayHandle(handles.tiktok));
  }

  if (sellerLine && target !== "instagram" && target !== "facebook" && target !== "x" && target !== "tiktok") {
    lines.push(`Find us: ${sellerLine}`);
  } else if (sellerLine && (target === "instagram" || target === "tiktok" || target === "x" || target === "facebook")) {
    // Already added the matching network handle above; still surface other handles briefly.
    const others = sellerLine;
    if (others && !lines.some((line) => line.includes(others))) {
      lines.push(others);
    }
  }

  lines.push(brandLine);
  return lines.filter(Boolean).join("\n");
}

export function buildAllCaptions(subject: ShareSubject, handles: SellerSocialHandles): Record<ShareTarget, string> {
  return {
    whatsapp: buildCaption("whatsapp", subject, handles),
    instagram: buildCaption("instagram", subject, handles),
    facebook: buildCaption("facebook", subject, handles),
    x: buildCaption("x", subject, handles),
    tiktok: buildCaption("tiktok", subject, handles),
  };
}

/** Practical, short coaching for filming, writing, timing, and where to put the link. */
export function coachingTips(subject: ShareSubject, handles: SellerSocialHandles): CoachingTip[] {
  const url = subject.url;
  const missing = missingHandleKeys(handles);
  const tips: CoachingTip[] = [
    {
      id: "film",
      title: "What to film or photograph",
      body:
        subject.kind === "listing"
          ? `Take one clear daylight photo of ${subject.name.trim()}. Show the whole item, then a close detail. Avoid heavy filters.`
          : `Film a 10–15 second walk past your counter or shelf. End on your sign or a bestseller. Keep it steady and well lit.`,
    },
    {
      id: "write",
      title: "What to write",
      body: `Use only real facts from your Rangach page (name, town, price). Paste the ready caption and keep ${url} in the post.`,
    },
    {
      id: "when",
      title: "When to post",
      body: "Mornings (7–9) and early evening (5–7) work well for WhatsApp Status and Instagram. Post once, then again in a few days with a new photo.",
    },
    {
      id: "bio",
      title: "Put the Rangach link where people can tap it",
      body: `Add ${url} in your Instagram / TikTok bio and at the end of Facebook, X, and WhatsApp posts. Stories: paste the link in the sticker or reply.`,
    },
    {
      id: "channels",
      title: "Where to share",
      body: "WhatsApp Status for regulars, Instagram Feed or Story for photos, Facebook for longer notes, X for a short link post, TikTok for a quick shop clip. Download the branded card and attach it.",
    },
  ];
  if (missing.length > 0) {
    tips.unshift({
      id: "handles",
      title: "Save your social handles",
      body: `Your shop is missing: ${missing.join(", ")}. Add them under shop settings so captions can mention your own accounts.`,
    });
  }
  return tips;
}

export function tipCardText(tip: CoachingTip, subject: ShareSubject, handles: SellerSocialHandles): string {
  const sellerLine = sellerSocialLine(handles);
  return [
    tip.title,
    tip.body,
    "",
    `Rangach link: ${subject.url}`,
    sellerLine ? `Your socials: ${sellerLine}` : "Your socials: add handles in shop settings",
    rangachSocialLine(),
  ].join("\n");
}
