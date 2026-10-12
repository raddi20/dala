/** Short tag on a photo card. Housing wins over the listing type. */
export function itemKindTag(input: { kind: "offering" | "listing"; type?: string; category?: string }): string {
  if (input.kind === "offering") return "Shop";
  const category = (input.category ?? "").toLowerCase();
  if (
    category.includes("housing") ||
    category.includes("real estate") ||
    category.includes("short stay") ||
    category.includes("land")
  ) {
    return "Housing";
  }
  if ((input.type ?? "") === "business") return "Shop";
  return "For sale";
}

export function itemPriceText(price: string | null | undefined): { text: string; ask: boolean } {
  const text = price?.trim() ?? "";
  if (!text) return { text: "Ask for price", ask: true };
  return { text, ask: false };
}

export function shopIsChecked(flags: {
  verified?: boolean;
  phoneVerified?: boolean;
  locationVerified?: boolean;
  businessVerified?: boolean;
}): boolean {
  return Boolean(flags.verified || flags.phoneVerified || flags.locationVerified || flags.businessVerified);
}

export function firstPhoto(urls: Array<string | null | undefined>): string {
  for (const url of urls) {
    const trimmed = url?.trim() ?? "";
    if (trimmed) return trimmed;
  }
  return "";
}

export function showScamChip(scamRisk: string | null | undefined): boolean {
  return scamRisk === "medium" || scamRisk === "high";
}
