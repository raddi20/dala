const RULES: { level: "high" | "medium"; pattern: RegExp; reason: string }[] = [
  {
    level: "high",
    pattern: /western union|moneygram|wire transfer/i,
    reason: "Asks for a wire or money-transfer service",
  },
  {
    level: "high",
    pattern: /send (?:the )?(?:money|deposit|payment|cash) first|pay (?:first|upfront|before)/i,
    reason: "Asks for payment before a meeting or inspection",
  },
  {
    level: "high",
    pattern: /gift ?cards?|bitcoin|crypto|\busdt\b/i,
    reason: "Asks for gift cards or crypto",
  },
  {
    level: "high",
    pattern: /guaranteed (?:return|profit|income)|double your money/i,
    reason: "Promises guaranteed or doubled money",
  },
  {
    level: "high",
    pattern: /investment opportunity/i,
    reason: "Investment pitch in a listing",
  },
  {
    level: "medium",
    pattern: /act now|limited (?:time )?offer|100% legit|no inspection|kindly (?:send|pay)/i,
    reason: "High-pressure or unverifiable language",
  },
  {
    level: "medium",
    pattern: /whatsapp only/i,
    reason: "Refuses any contact channel except WhatsApp",
  },
  {
    level: "medium",
    pattern: /!!!|[A-Z]{10,}/,
    reason: "Shouting or exaggerated punctuation",
  },
];

export type ScamLevel = "low" | "medium" | "high";

export function assessScam(input: { title: string; description: string; priceLabel?: string }) {
  const text = `${input.title}\n${input.description}\n${input.priceLabel ?? ""}`;
  const reasons: string[] = [];
  let level: ScamLevel = "low";

  for (const rule of RULES) {
    if (rule.pattern.test(text) && !reasons.includes(rule.reason)) {
      reasons.push(rule.reason);
      if (rule.level === "high") level = "high";
      else if (level === "low") level = "medium";
    }
  }

  if (/(?:free|cheap).{0,40}(?:deposit|fee)/i.test(text)) {
    reasons.push("Pairs a bargain with an upfront fee");
    if (level === "low") level = "medium";
  }

  return { level, notes: reasons.join("; ") };
}
