import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { prisma } from "@/lib/prisma";
import { normaliseText } from "@/lib/voice-correct";

/** Most words Sulwe takes from the catalogue. Small enough to send with every chat. */
export const VOICE_VOCAB_MAX = 200;
/** A word must be in at least this many public titles. One-off words (often a name) stay out. */
export const VOICE_VOCAB_MIN_TITLES = 2;
export const VOICE_VOCAB_TTL_MS = 10 * 60 * 1000;

const SKIP = new Set(
  (
    "with from your this that have will what when where which there their them they very more most just only also into over " +
    "near best good great nice fresh cheap free sale sell selling call whatsapp phone order orders delivery available " +
    "kenya each other some many much here sizes size price prices per plus home back new used open daily weekly"
  ).split(" "),
);

/**
 * Keywords from public listing and offering titles. A word must appear in two or more titles, and
 * words that are part of any account name (or its possessive) are dropped, so no personal name is sent. Phones, emails, numbers and short words never qualify.
 * Shop names are not used: on Rangach a shop's name is the seller's own name.
 */
export function catalogueKeywords(input: { titles: readonly string[]; personalNames: readonly string[] }, max = VOICE_VOCAB_MAX): string[] {
  const personal = new Set(input.personalNames.flatMap((name) => normaliseText(name).split(" ")).filter(Boolean));
  const counts = new Map<string, number>();
  for (const title of input.titles) {
    if (/@|\d{4,}/.test(title)) continue;
    const seen = new Set<string>();
    for (const word of normaliseText(title).split(" ")) {
      if (word.length < 4 || word.length > 20 || /\d/.test(word)) continue;
      // "Akinyis" is "Akinyi's" once the apostrophe goes.
      const base = word.endsWith("s") ? word.slice(0, -1) : word;
      if (SKIP.has(word) || personal.has(word) || personal.has(base) || seen.has(word)) continue;
      seen.add(word);
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= VOICE_VOCAB_MIN_TITLES)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word]) => word);
}

let cached: { at: number; words: string[] } | null = null;

/** Catalogue keywords, cached in memory for ten minutes. */
export async function voiceVocabulary(now = Date.now()): Promise<string[]> {
  if (cached && now - cached.at < VOICE_VOCAB_TTL_MS) return cached.words;
  const [listings, offerings, owners] = await Promise.all([
    prisma.listing.findMany({ where: publicListingWhere(), select: { title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.offering.findMany({
      where: { archived: false, hidden: false, storefront: publicShopWhere({ published: true }) },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({ select: { name: true }, take: 5000 }),
  ]);
  const words = catalogueKeywords({
    titles: [...listings.map((row) => row.title), ...offerings.map((row) => row.title)],
    personalNames: owners.map((row) => row.name ?? ""),
  });
  cached = { at: now, words };
  return words;
}

export function resetVoiceVocabularyCache() {
  cached = null;
}
