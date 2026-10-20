export const THUMB_EDGES = [480, 960] as const;
export type ThumbEdge = (typeof THUMB_EDGES)[number];

export type VariantRecord = {
  thumb480: string | null;
  thumb960: string | null;
  longest: number | null;
};

/** Sizes for a two-column phone card that grows a little on a wide screen. */
export const CARD_SIZES = "(min-width: 1024px) 280px, 50vw";

export function variantPathname(sourceUrl: string, edge: ThumbEdge): string | null {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (sourceUrl.includes("..") || sourceUrl.includes("\\") || sourceUrl.includes("\0")) return null;
  let path = "";
  try {
    path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }
  if (!path || path.includes("..")) return null;
  const slash = path.lastIndexOf("/");
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  if (!stem || stem.endsWith(`.w${edge}`)) return null;
  return `${dir}${stem}.w${edge}.webp`;
}

/** Sizes worth storing. Never upscale, so a small original needs nothing. */
export function thumbsNeeded(longest: number): ThumbEdge[] {
  if (!Number.isFinite(longest) || longest <= 0) return [];
  const need: ThumbEdge[] = [];
  if (longest > 480) need.push(480);
  if (longest > 960) need.push(960);
  return need;
}

export function isVariantComplete(row: VariantRecord | null | undefined): boolean {
  if (!row || row.longest == null || !Number.isFinite(row.longest)) return false;
  const need = thumbsNeeded(row.longest);
  if (need.includes(480) && !row.thumb480) return false;
  if (need.includes(960) && !row.thumb960) return false;
  return true;
}

export type CardPhoto = {
  src: string;
  srcSet?: string;
  sizes: string;
  width: number;
  height: number;
  loading: "lazy" | "eager";
  decoding: "async";
  fetchPriority?: "high" | "auto";
};

function unsplashSized(url: string, width: number, quality = 60): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "images.unsplash.com") return null;
  parsed.searchParams.set("auto", "format");
  parsed.searchParams.set("fit", "crop");
  parsed.searchParams.set("fm", "webp");
  parsed.searchParams.set("q", String(quality));
  parsed.searchParams.set("w", String(width));
  return parsed.toString();
}

/**
 * Card <img> attributes. Stored WebP variants win. An Unsplash seed URL is
 * asked for a 480px WebP instead of the full upload. Anything else uses the
 * original until a variant row exists.
 */
export function cardPhoto(input: {
  src: string;
  thumb480?: string | null;
  thumb960?: string | null;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  /** Weak-data mode: the 480px copy only, never the 960px one. */
  lite?: boolean;
}): CardPhoto | null {
  const original = input.src.trim();
  if (!original) return null;
  const parts: string[] = [];
  if (input.thumb480) parts.push(`${input.thumb480} 480w`);
  if (input.thumb960 && !input.lite) parts.push(`${input.thumb960} 960w`);
  let src = input.thumb480 || input.thumb960 || original;
  if (parts.length === 0) {
    const small = unsplashSized(original, input.lite ? 360 : 480, input.lite ? 45 : 60);
    const mid = input.lite ? small : unsplashSized(original, 960);
    if (small && input.lite) {
      src = small;
      parts.push(`${small} 360w`);
    } else if (small && mid) {
      src = small;
      parts.push(`${small} 480w`, `${mid} 960w`);
    }
  }
  const priority = Boolean(input.priority);
  return {
    src,
    srcSet: parts.length > 0 ? parts.join(", ") : undefined,
    // Lite: one small candidate, so the browser never reaches for a bigger file on a sharp screen.
    sizes: input.lite && parts.length > 0 ? "100vw" : (input.sizes ?? CARD_SIZES),
    width: input.width,
    height: input.height,
    loading: priority ? "eager" : "lazy",
    decoding: "async",
    fetchPriority: priority ? "high" : "auto",
  };
}

/** Dry-run is the default. Writing on the production host needs an extra flag. */
export function backfillMode(apply: boolean, production: boolean, yesProduction: boolean): "dry-run" | "apply" | "refuse" {
  if (apply && production && !yesProduction) return "refuse";
  return apply ? "apply" : "dry-run";
}

export function blobHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "blob.vercel-storage.com" || host.endsWith(".blob.vercel-storage.com");
}
