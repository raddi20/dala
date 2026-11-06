/** Normalize and format seller social handles. Never invent a handle. */

export type SellerSocialHandles = {
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
  whatsapp: string;
};

const HANDLE_MAX = 80;

/** Strip @, spaces, and full profile URLs down to a bare handle or page path. */
export function normalizeSocialHandle(raw: string, network: "instagram" | "facebook" | "x" | "tiktok"): string {
  let value = (raw ?? "").trim();
  if (!value) return "";
  value = value.replace(/\s+/g, "");
  const prefixes: Record<typeof network, RegExp[]> = {
    instagram: [/^https?:\/\/(www\.)?instagram\.com\//i],
    facebook: [/^https?:\/\/(www\.)?(facebook|fb)\.com\//i],
    x: [/^https?:\/\/(www\.)?(twitter|x)\.com\//i],
    tiktok: [/^https?:\/\/(www\.)?tiktok\.com\/@?/i],
  };
  for (const prefix of prefixes[network]) {
    if (prefix.test(value)) {
      value = value.replace(prefix, "");
      break;
    }
  }
  value = value.replace(/^@+/, "").split(/[/?#]/)[0] ?? "";
  value = value.slice(0, HANDLE_MAX);
  if (!value) return "";
  // Allow letters, numbers, dots, underscores, hyphens (Facebook pages use hyphens).
  if (!/^[A-Za-z0-9._-]+$/.test(value)) return "";
  return value;
}

export function displayHandle(raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return value.startsWith("@") ? value : `@${value}`;
}

export function profileUrl(network: "instagram" | "facebook" | "x" | "tiktok", handle: string): string {
  const bare = normalizeSocialHandle(handle, network);
  if (!bare) return "";
  if (network === "instagram") return `https://www.instagram.com/${bare}`;
  if (network === "facebook") return `https://www.facebook.com/${bare}`;
  if (network === "x") return `https://x.com/${bare}`;
  return `https://www.tiktok.com/@${bare}`;
}

export function handlesFromShop(input: {
  instagramHandle?: string | null;
  facebookHandle?: string | null;
  xHandle?: string | null;
  tiktokHandle?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
}): SellerSocialHandles {
  return {
    instagram: normalizeSocialHandle(input.instagramHandle ?? "", "instagram"),
    facebook: normalizeSocialHandle(input.facebookHandle ?? "", "facebook"),
    x: normalizeSocialHandle(input.xHandle ?? "", "x"),
    tiktok: normalizeSocialHandle(input.tiktokHandle ?? "", "tiktok"),
    whatsapp: (input.whatsapp ?? input.phone ?? "").trim(),
  };
}

export function missingHandleKeys(handles: SellerSocialHandles): Array<keyof SellerSocialHandles> {
  const missing: Array<keyof SellerSocialHandles> = [];
  if (!handles.instagram) missing.push("instagram");
  if (!handles.facebook) missing.push("facebook");
  if (!handles.x) missing.push("x");
  if (!handles.tiktok) missing.push("tiktok");
  if (!handles.whatsapp) missing.push("whatsapp");
  return missing;
}

export function sellerSocialLine(handles: SellerSocialHandles): string {
  const parts: string[] = [];
  if (handles.instagram) parts.push(`Instagram ${displayHandle(handles.instagram)}`);
  if (handles.facebook) parts.push(`Facebook ${profileUrl("facebook", handles.facebook)}`);
  if (handles.x) parts.push(`X ${displayHandle(handles.x)}`);
  if (handles.tiktok) parts.push(`TikTok ${displayHandle(handles.tiktok)}`);
  if (handles.whatsapp) parts.push(`WhatsApp ${handles.whatsapp}`);
  return parts.join(" · ");
}
