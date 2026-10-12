import { normalizePath } from "@/lib/back-nav";

/** Smart search. There is no chat yet, so Ask opens the sentence search. */
export const ASK_HREF = "/listings?nl=#search";

export type BottomTab = "home" | "explore" | "ask" | "occasions" | "sell";

export function activeBottomTab(pathname: string, search = ""): BottomTab | null {
  const path = normalizePath(pathname);
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  if (path === "/") return "home";
  if (path === "/occasions" || path.startsWith("/occasions/")) return "occasions";
  if (path === "/list" || path === "/listings/new" || path.startsWith("/account/storefront")) return "sell";
  if (path === "/listings" && params.has("nl")) return "ask";
  if (
    path === "/listings" ||
    path.startsWith("/listings/") ||
    path === "/shops" ||
    path === "/categories" ||
    path.startsWith("/categories/") ||
    path.startsWith("/b/")
  ) {
    return "explore";
  }
  return null;
}
