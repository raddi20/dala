export type StatKind = "listing_view" | "shop_view" | "whatsapp_tap" | "call_tap";

export function viewKindForPath(pathname: string): "listing_view" | "shop_view" | null {
  const path = stripPath(pathname);
  if (/^\/listings\/[^/]+$/.test(path)) return "listing_view";
  if (/^\/b\/[^/]+$/.test(path)) return "shop_view";
  return null;
}

export function tapKindForHref(href: string): "whatsapp_tap" | "call_tap" | null {
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith("tel:")) return "call_tap";
  try {
    const url = new URL(value, "https://rangach.co.ke");
    if (url.protocol === "tel:") return "call_tap";
    if (url.hostname === "wa.me" || url.hostname === "api.whatsapp.com") return "whatsapp_tap";
  } catch {
    if (value.includes("wa.me") || value.includes("api.whatsapp.com")) return "whatsapp_tap";
  }
  return null;
}

export function pathTarget(pathname: string): { kind: "listing"; id: string } | { kind: "shop"; slug: string } | null {
  const path = stripPath(pathname);
  const listing = /^\/listings\/([^/]+)$/.exec(path);
  if (listing) return { kind: "listing", id: decodeURIComponent(listing[1]) };
  const shop = /^\/b\/([^/]+)$/.exec(path);
  if (shop) return { kind: "shop", slug: decodeURIComponent(shop[1]) };
  return null;
}

function stripPath(pathname: string): string {
  const noHash = pathname.split("#")[0] ?? "";
  const noQuery = noHash.split("?")[0] ?? "";
  const trimmed = noQuery.replace(/\/+$/, "");
  return trimmed || "/";
}

const BOT = /bot|spider|crawl|slurp|headless|preview|facebookexternalhit|whatsapp|telegram|discord|embedly|quora|pinterest|wget|curl|python-requests|go-http|bytespider|petalbot|semrush|ahrefs|lighthouse|monitoring/i;

export function isAutomatedAgent(userAgent: string): boolean {
  const agent = userAgent.trim();
  if (!agent) return true;
  return BOT.test(agent);
}
