/**
 * Shop-update blocklist.
 *
 * Add a phrase to extend it. Matching is whole words and phrases, after
 * lowercasing, so ordinary shop words are left alone.
 * Generic political and campaign language, plus obvious money-scam patterns.
 * Do not add insults.
 */
export const UPDATE_BLOCKLIST = {
  politics: {
    en: [
      "election",
      "elections",
      "vote for",
      "political party",
      "polling station",
      "ballot",
      "manifesto",
      "member of parliament",
      "campaign rally",
    ],
    sw: ["uchaguzi", "kura", "mgombea", "kampeni", "siasa", "chama cha siasa"],
    sheng: ["kura", "siasa", "mgombea"],
    /** Dholuo for choosing in an election. Add further phrases in this list. */
    dholuo: ["yiero"],
  },
  scam: ["double your money", "guaranteed return", "wire transfer", "western union", "bitcoin", "investment opportunity"],
  money: ["m-pesa", "mpesa", "paybill", "till number", "till no", "lipa na", "send money", "send a deposit", "paypal"],
} as const;

export function blocklistPhrases(): string[] {
  const { politics, scam, money } = UPDATE_BLOCKLIST;
  return [...politics.en, ...politics.sw, ...politics.sheng, ...politics.dholuo, ...scam, ...money];
}
