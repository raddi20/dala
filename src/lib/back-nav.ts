/** Where Back goes when this visit did not start inside the site. */
export type BackPlace = {
  pathname: string;
  search?: string;
  hash?: string;
};

export const IN_APP_NAV_KEY = "rangach-nav";

export function normalizePath(pathname: string): string {
  const bare = (pathname.split("?")[0] ?? pathname).split("#")[0] ?? "/";
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1);
  return bare || "/";
}

export function showsBackBar(pathname: string): boolean {
  return normalizePath(pathname) !== "/";
}

function categoryQuery(search: string): string {
  return new URLSearchParams(search.replace(/^\?/, "")).get("category")?.trim() ?? "";
}

/**
 * Parent for a cold visit (WhatsApp, a QR sticker, Google).
 * In-app visits use history instead, so search and scroll stay put.
 */
export function backFallback(place: BackPlace): string {
  const path = normalizePath(place.pathname);
  const hash = place.hash ?? "";
  const shop = path.match(/^\/b\/([^/]+)$/);
  if (shop && hash.startsWith("#offering-")) return path;
  const sticker = path.match(/^\/b\/([^/]+)\/sticker$/);
  if (sticker) return `/b/${sticker[1]}`;
  if (shop) return "/shops";

  if (path === "/listings" && categoryQuery(place.search ?? "")) return "/categories";
  const edit = path.match(/^\/listings\/([^/]+)\/edit$/);
  if (edit && edit[1] !== "new") return `/listings/${edit[1]}`;
  const listing = path.match(/^\/listings\/([^/]+)$/);
  if (listing && listing[1] !== "new") return "/listings";
  if (path === "/listings/new") return "/listings";

  const occasion = path.match(/^\/occasions\/([^/]+)$/);
  if (occasion) return "/occasions";
  if (path.startsWith("/account/")) return "/account";
  if (path.startsWith("/admin/")) return "/admin";
  return "/";
}

/** Short label before the document title is ready. The bar truncates it. */
export function backBarTitle(place: BackPlace): string {
  const path = normalizePath(place.pathname);
  const category = path === "/listings" ? categoryQuery(place.search ?? "") : "";
  if (category) return category;
  const known: Record<string, string> = {
    "/shops": "Shops",
    "/listings": "Browse",
    "/categories": "Categories",
    "/occasions": "Occasions",
    "/account": "Account",
    "/safety": "Safety",
    "/contact": "Contact",
    "/about": "About",
    "/faq": "FAQ",
    "/terms": "Terms",
    "/privacy": "Privacy",
    "/refund": "Refunds",
    "/welcome": "Welcome",
    "/list": "List your business",
    "/pricing": "Pricing",
    "/login": "Sign in",
    "/register": "Create account",
    "/forgot-password": "Forgot password",
    "/reset-password": "Choose a new password",
    "/admin": "Admin",
    "/admin/phones": "Phone numbers",
  };
  if (known[path]) return known[path];
  if (/^\/b\/[^/]+\/sticker$/.test(path)) return "Print sticker";
  if (/^\/b\/[^/]+$/.test(path) && (place.hash ?? "").startsWith("#offering-")) return "Offering";
  if (/^\/b\/[^/]+$/.test(path)) return "Shop";
  if (/^\/listings\/[^/]+\/edit$/.test(path)) return "Edit listing";
  if (path === "/listings/new") return "New listing";
  if (/^\/listings\/[^/]+$/.test(path)) return "Listing";
  if (/^\/people\/[^/]+$/.test(path)) return "Profile";
  if (/^\/occasions\/[^/]+$/.test(path)) return "Occasion";
  if (path.startsWith("/account/")) return "Account";
  if (/^\/admin\/contact\/[^/]+\/[^/]+$/.test(path)) return "Edit contact";
  if (path.startsWith("/admin")) return "Admin";
  return "Back";
}

/** Document title without the " · Rangach" suffix. Empty when it is only the brand. */
export function pageTitleFromDocument(title: string, brand: string): string {
  const trimmed = title.trim();
  const suffix = ` · ${brand}`;
  const bare = trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length).trim() : trimmed;
  if (!bare || bare === brand) return "";
  return bare;
}

/**
 * True when Back should call history.back().
 * A stored in-app step counts, and so does a same-origin referrer with somewhere to go back to.
 */
export function cameFromApp(input: {
  navCount: number;
  referrer: string;
  historyLength: number;
  origin: string;
}): boolean {
  if (input.navCount > 0) return true;
  if (input.historyLength <= 1) return false;
  const referrer = input.referrer.trim();
  if (!referrer) return false;
  try {
    return new URL(referrer).origin === input.origin;
  } catch {
    return false;
  }
}
