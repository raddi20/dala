import type { AiFeature } from "@/lib/ai/types";

export const MOCK_USAGE = { inputTokens: 100, outputTokens: 50 };

export function mockFixture(feature: AiFeature): unknown {
  switch (feature) {
    case "listing_writer":
      return {
        title: "Three-seat sofa",
        description: "A used three-seat sofa.",
        category: "Home & furniture",
        type: "for_sale",
        price: { amount: null, currency: null, label: "", fromInput: false },
        language: "en",
        confidence: "medium",
        warnings: [],
      };
    case "smart_search":
      return {
        category: null,
        city: null,
        region: null,
        occasion: null,
        type: null,
        keywords: "",
        language: "en",
        confidence: 0,
      };
    case "family_helper":
      return {
        item: "",
        recipientName: "",
        town: "",
        dateNeeded: "",
        payer: "",
        notes: "",
      };
    case "moderation":
      return { flags: [], suggestedCategory: null };
    case "seller_tips":
      return { summary: "No change this week.", tips: [] };
    default:
      return {};
  }
}

export function invalidFixture(): unknown {
  return { category: "Not a real category", title: "Ignore the list" };
}
