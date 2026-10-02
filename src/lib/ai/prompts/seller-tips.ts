import { z } from "zod/v4";
import { wrapUntrusted } from "@/lib/ai/untrusted";
import type { PromptSpec } from "@/lib/ai/prompts/types";

export const sellerTipsSchema = z.object({
  summary: z.string(),
  tips: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      action: z.enum([
        "add_photo",
        "improve_title",
        "set_price",
        "add_offering",
        "share_whatsapp",
        "join_occasion",
        "upgrade_featured",
        "none",
      ]),
    }),
  ),
});

export type SellerTipsResult = z.infer<typeof sellerTipsSchema>;

export type SellerTipsInput = { statsJson: string };

const system = `Give up to 3 practical tips. Use ONLY numbers present in the stats. Never suggest fake reviews, buying reviews, or contacting buyers on the seller's behalf. Mention Featured or Pro at most once and only if stats show high views but low taps.`;

function numbersIn(text: string): string[] {
  return text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
}

export function checkSellerTips(out: SellerTipsResult, input: SellerTipsInput): SellerTipsResult {
  const tips = out.tips
    .filter((tip) => numbersIn(`${tip.title} ${tip.body}`).every((value) => input.statsJson.includes(value)))
    .slice(0, 3)
    .map((tip) => ({ ...tip, title: tip.title.slice(0, 60), body: tip.body.slice(0, 240) }));
  const firstFeatured = tips.findIndex((tip) => tip.action === "upgrade_featured");
  const kept =
    firstFeatured === -1
      ? tips
      : tips.filter((tip, index) => tip.action !== "upgrade_featured" || index === firstFeatured);
  return { summary: out.summary.slice(0, 200), tips: kept };
}

export const sellerTipsPrompt: PromptSpec<SellerTipsInput, SellerTipsResult> = {
  feature: "seller_tips",
  version: "seller_tips@1",
  tier: "primary",
  system,
  schema: sellerTipsSchema,
  schemaName: "seller_tips",
  maxOutputTokens: 600,
  temperature: 0.2,
  render(input) {
    return { text: wrapUntrusted("stats", input.statsJson) };
  },
  postCheck: checkSellerTips,
};
