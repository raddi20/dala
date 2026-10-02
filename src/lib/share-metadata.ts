import type { Metadata } from "next";
import { appName } from "@/lib/brand";

/** WhatsApp and Facebook expect a large preview. 1200×630 is the usual card. */
export const OG_IMAGE = {
  width: 1200,
  height: 630,
  contentType: "image/png",
} as const;

export function absoluteUrl(origin: string, path: string) {
  const base = origin.replace(/\/$/, "");
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function clipText(value: string, max = 180) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return true;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/**
 * Absolute image URL safe to put in a public preview.
 * Https only for remote images. Same-site paths are allowed when origin is passed.
 * Private hosts, credentials, and our own generated-image routes are rejected.
 */
export function publicImageUrl(value: string, origin = "") {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return "";
  if (trimmed.startsWith("/")) {
    if (!origin) return "";
    if (trimmed.includes("opengraph-image") || trimmed.startsWith("/og/")) return "";
    return absoluteUrl(origin, trimmed);
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (url.username || url.password) return "";
  if (isPrivateHost(url.hostname)) return "";
  return url.toString();
}

export type ShareImageInput = {
  origin: string;
  /** Path or absolute URL of the page. */
  path: string;
  title: string;
  description: string;
  /** Absolute image URL, or a site path such as /b/slug/opengraph-image. */
  image: string;
  imageAlt: string;
  /** null omits og:image:type. Undefined means our generated PNG. */
  imageType?: string | null;
};

export function buildShareMetadata(input: ShareImageInput): Metadata {
  const canonical = absoluteUrl(input.origin, input.path);
  const imageUrl = absoluteUrl(input.origin, input.image);
  const image = {
    url: imageUrl,
    width: OG_IMAGE.width,
    height: OG_IMAGE.height,
    alt: input.imageAlt,
    ...(input.imageType === null ? {} : { type: input.imageType || OG_IMAGE.contentType }),
  };
  const name = appName();
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      siteName: name,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

/** No description, image, or canonical. Used for hidden listings and unpublished shops. */
export function privateMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export function generatedImagePath(path: string) {
  return path.endsWith("/opengraph-image") ? path : `${path.replace(/\/$/, "")}/opengraph-image`;
}

export function shopPreviewImage(input: {
  origin: string;
  slug: string;
  published: boolean;
  verifiedPro: boolean;
  bannerUrl: string;
  avatarUrl: string;
  hasPublicVideo?: boolean;
}) {
  if (!input.published) return null;
  if (input.hasPublicVideo) {
    return {
      url: absoluteUrl(input.origin, `/b/${encodeURIComponent(input.slug)}/video-card`),
      generated: true as const,
      contentType: "image/jpeg" as const,
    };
  }
  const cover = input.verifiedPro ? publicImageUrl(input.bannerUrl) : "";
  const logo = publicImageUrl(input.avatarUrl);
  const photo = cover || logo;
  if (photo) return { url: photo, generated: false as const, contentType: null };
  return {
    url: absoluteUrl(input.origin, `/b/${encodeURIComponent(input.slug)}/opengraph-image`),
    generated: true as const,
    contentType: undefined,
  };
}

export function listingPreviewImage(input: {
  origin: string;
  id: string;
  hidden: boolean;
  photoUrl: string;
}) {
  if (input.hidden) return null;
  const photo = publicImageUrl(input.photoUrl);
  if (photo) return { url: photo, generated: false as const };
  return {
    url: absoluteUrl(input.origin, `/listings/${encodeURIComponent(input.id)}/opengraph-image`),
    generated: true as const,
  };
}
