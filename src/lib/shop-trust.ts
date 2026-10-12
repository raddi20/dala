import { cityChipLabel } from "@/lib/constants";

export type ShopTrustFlags = {
  phoneVerified?: boolean;
  locationVerified?: boolean;
  businessVerified?: boolean;
  verified?: boolean;
};

/** One trust line. Only the checks that were actually granted are named. */
export function shopTrustLine(flags: ShopTrustFlags): string {
  const parts: string[] = [];
  if (flags.phoneVerified) parts.push("phone");
  if (flags.locationVerified) parts.push("location");
  if (flags.businessVerified) parts.push("business visit");
  if (parts.length > 0) return `Checked by Rangach: ${parts.join(", ")}`;
  if (flags.verified) return "Checked by Rangach";
  return "";
}

export function shopPlaceLine(category: string, city: string): string {
  return [category.trim(), cityChipLabel(city)].filter(Boolean).join(" · ");
}
