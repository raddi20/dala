import { isDemoEmail } from "@/lib/admin-access";

/** Seeded demo shop titles. Match by name as a belt-and-braces check beside @dala.local. */
export const DEMO_SHOP_NAME_MARKERS = ["Mama Atieno", "Okello & Co", "Peckham Grocer"] as const;

export function isDemoShopName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  if (!lower) return false;
  return DEMO_SHOP_NAME_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

/** True when this owner/shop must never get seller emails. */
export function shouldSkipSellerEmail(input: { email?: string | null; shopName?: string | null }): boolean {
  const email = (input.email ?? "").trim();
  if (!email || !email.includes("@")) return true;
  if (isDemoEmail(email)) return true;
  if (isDemoShopName(input.shopName ?? "")) return true;
  return false;
}
