/**
 * Fixes common mishearings in Sulwe's voice search before it reaches Ask Rangach.
 * Pure TypeScript, no dependencies. Safe on the server and in the browser.
 *
 * Order: hand-mapped mishearings ("fun guy" → fundi), then exact vocabulary words,
 * then fuzzy matches on words and short word runs (phonetic key plus edit distance).
 * Ordinary words are left alone, and speech that is not near the vocabulary stays as said.
 */
import { CATEGORIES } from "@/lib/categories";
import { TOWNS } from "@/lib/constants";
import { nlKeywords } from "@/lib/nl-query";

export type Mishearing = {
  /** Lowercase words, separated by single spaces, as the normaliser produces them. */
  heard: string;
  to: string;
  /** Rude or awkward on screen. The raw transcript is hidden when one of these is used. */
  awkward?: boolean;
  /** Also an ordinary phrase. Only mapped when the query has another Rangach word, like a town. */
  needsContext?: boolean;
};

export const MISHEARINGS: readonly Mishearing[] = [
  // fundi
  { heard: "fun guy", to: "fundi" },
  { heard: "fun guys", to: "fundi" },
  { heard: "fungi", to: "fundi" },
  { heard: "fungie", to: "fundi" },
  { heard: "fun gi", to: "fundi" },
  { heard: "fundy", to: "fundi" },
  { heard: "fundie", to: "fundi" },
  { heard: "fundee", to: "fundi" },
  { heard: "fondi", to: "fundi" },
  { heard: "fondy", to: "fundi" },
  { heard: "fandi", to: "fundi" },
  { heard: "fun d", to: "fundi" },
  { heard: "fun dee", to: "fundi" },
  { heard: "fun di", to: "fundi" },
  { heard: "fan dee", to: "fundi" },
  { heard: "foon dee", to: "fundi" },
  { heard: "phone d", to: "fundi" },
  { heard: "phone dee", to: "fundi" },
  { heard: "phone de", to: "fundi" },
  { heard: "fun day", to: "fundi", needsContext: true },
  { heard: "phoned", to: "fundi", needsContext: true },
  { heard: "gay guy", to: "fundi", awkward: true },
  { heard: "gay guys", to: "fundi", awkward: true },
  { heard: "fun gay", to: "fundi", awkward: true },
  { heard: "gay d", to: "fundi", awkward: true },
  // ayie
  { heard: "i e", to: "ayie" },
  { heard: "ie", to: "ayie" },
  { heard: "aye", to: "ayie" },
  { heard: "aye e", to: "ayie" },
  { heard: "aye ee", to: "ayie" },
  { heard: "ayee", to: "ayie" },
  { heard: "ayi", to: "ayie" },
  { heard: "ayye", to: "ayie" },
  { heard: "ai ye", to: "ayie" },
  { heard: "a ye", to: "ayie" },
  { heard: "i ye", to: "ayie" },
  { heard: "i yay", to: "ayie" },
  { heard: "eye ye", to: "ayie" },
  { heard: "eye yay", to: "ayie" },
  { heard: "eye yeah", to: "ayie" },
  { heard: "eye e", to: "ayie" },
  { heard: "i a", to: "ayie", needsContext: true },
  // tilapia
  { heard: "tilapya", to: "tilapia" },
  { heard: "tilapiya", to: "tilapia" },
  { heard: "tilapa", to: "tilapia" },
  { heard: "tila pia", to: "tilapia" },
  { heard: "tilla pia", to: "tilapia" },
  { heard: "till apia", to: "tilapia" },
  { heard: "till a pia", to: "tilapia" },
  { heard: "till up ya", to: "tilapia" },
  { heard: "tell apia", to: "tilapia" },
  { heard: "tea lapia", to: "tilapia" },
  { heard: "teal apia", to: "tilapia" },
  // rech ngege is tilapia in Dholuo. Search speaks English, so it becomes tilapia.
  { heard: "rech ngege", to: "tilapia" },
  { heard: "ngege", to: "tilapia" },
  { heard: "reach ngege", to: "tilapia" },
  { heard: "rich ngege", to: "tilapia" },
  { heard: "retch ngege", to: "tilapia" },
  { heard: "wretch ngege", to: "tilapia" },
  { heard: "rech gege", to: "tilapia" },
  { heard: "reach gege", to: "tilapia" },
  { heard: "rich gege", to: "tilapia" },
  { heard: "rech negege", to: "tilapia" },
  { heard: "rech engege", to: "tilapia" },
  { heard: "rech nge ge", to: "tilapia" },
  { heard: "nge ge", to: "tilapia" },
  { heard: "reach and gay gay", to: "tilapia", awkward: true },
  { heard: "rich and gay gay", to: "tilapia", awkward: true },
  { heard: "and gay gay", to: "tilapia", awkward: true },
  { heard: "n gay gay", to: "tilapia", awkward: true },
  // dowry
  { heard: "dowery", to: "dowry" },
  { heard: "dowr y", to: "dowry" },
  { heard: "dawry", to: "dowry" },
  { heard: "dowri", to: "dowry" },
  { heard: "dowrie", to: "dowry" },
  { heard: "dowree", to: "dowry" },
  { heard: "dowary", to: "dowry" },
  { heard: "dawri", to: "dowry" },
  { heard: "dow ry", to: "dowry" },
  { heard: "dow ree", to: "dowry" },
  { heard: "dow re", to: "dowry" },
];

/** Words never changed by the fuzzy step. Common English that sits close to a town or trade. */
const PROTECTED = new Set(
  (
    "a an and are around at band bank bay be best bond bonds book buy by cab can car care cake cheap city cook cor dance day do doctor " +
    "design event events faith flat hair hand hire land money music orgs personal real second short shops sports stays tax tickets transfer travel video " +
    "eye eyes fish find food for from fun funny get girl give good guy have help hire home house i in is it kids " +
    "land last like look looking love make me mine mini moon more my near need new next now of off on one or our " +
    "party pay phone please price rent room see sell shop show sister some son table taxi tea the this to today town " +
    "want we wedding week with you your"
  ).split(" "),
);

const STOP_EDGE = new Set(["a", "an", "and", "the", "in", "for", "near", "me", "of", "to", "on", "at", "my", "i", "is", "with", "or"]);

/**
 * Occasion words, from the occasion titles in occasions.ts. Copied here because that file imports
 * Prisma, and this one runs in the browser. A test keeps the two in step.
 */
export const OCCASION_WORDS = ["homecomings", "homecoming", "weddings", "wedding", "dowry", "ayie", "christmas"] as const;

/** Categories Sulwe does not steer voice search towards. */
const SKIP_CATEGORY = /memorial/i;

/** Places people say that are not towns in the config. */
const EXTRA_PLACES = ["Kondele", "Nyalenda", "Manyatta", "Kibuye", "Dunga", "Rusinga", "Luanda", "Ahero", "Muhoroni", "Usenge", "Ndhiwa", "Rongo", "Awasi"];

const EXTRA_KEYWORDS = [
  "fundi", "fundis", "ayie", "dowry", "tilapia", "omena", "fish", "catering", "caterer", "tent", "tents", "chairs",
  "plumber", "electrician", "mason", "carpenter", "welder", "painter", "mechanic", "tailor", "salon", "barber",
  "photographer", "chapati", "mandazi", "nyama choma", "boda", "matatu", "transport", "pharmacy", "bakery",
  "butcher", "chicken", "ugali", "rental", "bedsitter", "decor", "sound", "solar", "tiles", "roofing",
];

export type Vocabulary = {
  /** Lowercase word or phrase → how to write it in the query. */
  forms: Map<string, string>;
};

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((word) => word.replace(/'/g, ""))
    .filter((word) => word.length >= 3);
}

/** Vocabulary from config: towns, categories, occasions, and search keywords, plus any extra words. */
export function buildVocabulary(extra: readonly string[] = []): Vocabulary {
  const forms = new Map<string, string>();
  const add = (term: string, display = term) => {
    const key = normaliseText(term);
    if (key.length < 3 || forms.has(key)) return;
    forms.set(key, display);
  };
  for (const town of TOWNS) {
    add(town.name, town.name);
    if ("aliases" in town) for (const alias of town.aliases) add(alias, town.name);
  }
  add("London", "London");
  for (const keyword of [...EXTRA_KEYWORDS, ...nlKeywords()]) add(keyword);
  for (const category of CATEGORIES) {
    if (SKIP_CATEGORY.test(category)) continue;
    for (const word of words(category)) add(word);
  }
  for (const word of OCCASION_WORDS) add(word);
  for (const place of EXTRA_PLACES) add(place, place);
  for (const term of extra) add(term);
  return { forms };
}

let baseVocabulary: Vocabulary | null = null;
export function defaultVocabulary(): Vocabulary {
  baseVocabulary ??= buildVocabulary();
  return baseVocabulary;
}

/** Lowercase, "I.E." → "i e", punctuation dropped, single spaces. */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A compact Metaphone-style key tuned for Kenyan English and Swahili place names.
 * Vowels after the first letter drop, soft c/g become s/j, ph is f, and r before a consonant
 * drops (non-rhotic speech: "homer bay" and "Homa Bay" share a key).
 */
export function phoneticKey(text: string): string {
  let w = text.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return "";
  w = w
    .replace(/^(kn|gn|pn|wr)/, (m) => m[1])
    .replace(/ph/g, "f")
    .replace(/gh/g, "")
    .replace(/ck/g, "k")
    .replace(/(sh|ch)/g, "x")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .replace(/ny/g, "n")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "f")
    .replace(/g(?=[eiy])/g, "j")
    .replace(/r(?![aeiouy])/g, "");
  if (!w) return "";
  const first = /[aeiouy]/.test(w[0]) ? "A" : w[0].toUpperCase();
  const rest = w
    .slice(1)
    .replace(/[hwaeiouy]/g, "")
    .toUpperCase();
  return (first + rest).replace(/(.)\1+/g, "$1");
}

/** Levenshtein distance. Inputs are short. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

export function normalisedDistance(a: string, b: string): number {
  const length = Math.max(a.length, b.length);
  return length === 0 ? 0 : editDistance(a, b) / length;
}

/** Fuzzy acceptance: same sound and close spelling, or very close spelling. */
export const FUZZY_SAME_KEY = 0.34;
/** Runs of two or three words ("key sumo") must share the sound key, and may differ a little more. */
export const FUZZY_RUN_SAME_KEY = 0.45;
export const FUZZY_ANY_KEY = 0.2;

export type Fix = { heard: string; to: string; kind: "mishearing" | "fuzzy"; awkward: boolean };

export type Correction = {
  raw: string;
  text: string;
  changed: boolean;
  /** Hide the raw words on screen: they went through an awkward or rude mishearing. */
  hideRaw: boolean;
  fixes: Fix[];
  /** Words in the result that Rangach knows (towns, trades, occasions). */
  hits: number;
};

const MISHEARING_BY_WORDS = new Map(MISHEARINGS.map((entry) => [entry.heard, entry]));
const MAX_MISHEARING_WORDS = Math.max(...MISHEARINGS.map((entry) => entry.heard.split(" ").length));

function isPlural(a: string, b: string) {
  return a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`;
}

function fuzzyMatch(joined: string, vocab: Vocabulary, single: boolean, common = false): string | null {
  if (joined.length < 4) return null;
  const key = phoneticKey(joined);
  if (key.length < (single ? 2 : 1)) return null;
  let best: { form: string; score: number } | null = null;
  for (const [term, form] of vocab.forms) {
    const compact = term.replace(/ /g, "");
    if (compact.length < 4 || PROTECTED.has(term)) continue;
    if (single && isPlural(joined, compact)) continue;
    const distance = normalisedDistance(joined, compact);
    const sameKey = phoneticKey(compact) === key;
    const ok = single
      ? sameKey
        ? distance <= FUZZY_SAME_KEY
        : distance <= FUZZY_ANY_KEY && joined.length >= 6
      : sameKey && distance <= (common ? FUZZY_ANY_KEY : FUZZY_RUN_SAME_KEY);
    if (!ok) continue;
    const score = 1 - distance + (sameKey ? 0.2 : 0);
    if (!best || score > best.score) best = { form, score };
  }
  return best?.form ?? null;
}

/** Correct one transcript. Returns the original text when nothing needs fixing. */
export function correctTranscript(raw: string, vocab: Vocabulary = defaultVocabulary()): Correction {
  const tokens = normaliseText(raw).split(" ").filter(Boolean);
  const out: { text: string; known: boolean }[] = [];
  const fixes: Fix[] = [];
  const pendingContext: { index: number; entry: Mishearing; heard: string }[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    // 1. Hand-mapped mishearings, longest first.
    for (let size = Math.min(MAX_MISHEARING_WORDS, tokens.length - i); size >= 1 && !matched; size -= 1) {
      const heard = tokens.slice(i, i + size).join(" ");
      const entry = MISHEARING_BY_WORDS.get(heard);
      if (!entry) continue;
      if (entry.needsContext) pendingContext.push({ index: out.length, entry, heard });
      else fixes.push({ heard, to: entry.to, kind: "mishearing", awkward: Boolean(entry.awkward) });
      out.push({ text: entry.needsContext ? heard : entry.to, known: !entry.needsContext });
      i += size;
      matched = true;
    }
    if (matched) continue;
    // 2. Exact vocabulary, longest phrase first.
    for (let size = Math.min(3, tokens.length - i); size >= 1 && !matched; size -= 1) {
      const phrase = tokens.slice(i, i + size).join(" ");
      const form = vocab.forms.get(phrase);
      // A common word ("home") may still start a run like "home a bay", so it waits for step 3.
      if (!form || (size === 1 && PROTECTED.has(phrase))) continue;
      out.push({ text: form, known: true });
      i += size;
      matched = true;
    }
    if (matched) continue;
    // 3. Fuzzy: runs of three or two words ("key sumo", "home a bay"), then one word.
    for (let size = Math.min(3, tokens.length - i); size >= 1 && !matched; size -= 1) {
      const run = tokens.slice(i, i + size);
      if (size > 1 && (STOP_EDGE.has(run[0]) || STOP_EDGE.has(run[run.length - 1]))) continue;
      if (run.some((word) => /\d/.test(word))) continue;
      if (size === 1 && (PROTECTED.has(run[0]) || run[0].length < 4)) continue;
      if (size > 1 && run.some((word) => vocab.forms.has(word) && !PROTECTED.has(word))) continue;
      const joined = run.join("");
      // A run of only common words ("car hire") must be a very close match ("home a bay").
      const common = size > 1 && run.every((word) => PROTECTED.has(word) || STOP_EDGE.has(word));
      const form = fuzzyMatch(joined, vocab, size === 1, common);
      if (!form) continue;
      if (normaliseText(form) !== run.join(" ")) fixes.push({ heard: run.join(" "), to: form, kind: "fuzzy", awkward: false });
      out.push({ text: form, known: true });
      i += size;
      matched = true;
    }
    if (matched) continue;
    out.push({ text: tokens[i], known: false });
    i += 1;
  }
  // Context-only mishearings apply when another Rangach word is in the query.
  const knownElsewhere = (index: number) => out.some((word, at) => at !== index && word.known);
  for (const { index, entry, heard } of pendingContext) {
    if (!knownElsewhere(index)) continue;
    out[index] = { text: entry.to, known: true };
    fixes.push({ heard, to: entry.to, kind: "mishearing", awkward: Boolean(entry.awkward) });
  }
  if (fixes.length === 0) {
    return { raw, text: raw.trim(), changed: false, hideRaw: false, fixes, hits: out.filter((word) => word.known).length };
  }
  const text = out.map((word) => word.text).join(" ");
  return {
    raw,
    text,
    changed: normaliseText(text) !== normaliseText(raw),
    hideRaw: fixes.some((fix) => fix.awkward),
    fixes,
    hits: out.filter((word) => word.known).length,
  };
}

/** Swap rude or awkward mishearings before showing live, half-heard words on screen. */
export function displaySafe(text: string): string {
  const tokens = normaliseText(text).split(" ").filter(Boolean);
  const awkward = MISHEARINGS.filter((entry) => entry.awkward);
  if (!awkward.some((entry) => ` ${tokens.join(" ")} `.includes(` ${entry.heard} `)) && !tokens.includes("gay")) return text;
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const entry = awkward
      .filter((row) => tokens.slice(i, i + row.heard.split(" ").length).join(" ") === row.heard)
      .sort((a, b) => b.heard.length - a.heard.length)[0];
    if (entry) {
      out.push(entry.to);
      i += entry.heard.split(" ").length;
    } else {
      out.push(tokens[i] === "gay" ? "…" : tokens[i]);
      i += 1;
    }
  }
  return out.join(" ");
}

export type Alternative = { transcript: string; confidence?: number };

export type VoicePick = Correction & { index: number };

/**
 * Choose the best of the browser's alternatives after correction. Each scores on the browser's
 * confidence, plus Rangach words it contains, minus each fix it needed. When the winning fixed text is
 * exactly what another alternative heard, that alternative is used and nothing is shown as corrected.
 */
export function pickBestAlternative(alternatives: readonly Alternative[], vocab: Vocabulary = defaultVocabulary()): VoicePick | null {
  const usable = alternatives
    .map((alternative, index) => ({ ...alternative, index, transcript: alternative.transcript.trim() }))
    .filter((alternative) => alternative.transcript);
  if (usable.length === 0) return null;
  const scored = usable.map((alternative) => {
    const correction = correctTranscript(alternative.transcript, vocab);
    const confidence =
      typeof alternative.confidence === "number" && alternative.confidence > 0 ? alternative.confidence : 0.5 - alternative.index * 0.05;
    const score = confidence + 0.2 * Math.min(correction.hits, 3) - 0.08 * correction.fixes.length;
    return { correction, index: alternative.index, score };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = scored[0];
  if (best.correction.changed) {
    const target = normaliseText(best.correction.text);
    const heardAsIs = scored.find((row) => normaliseText(row.correction.raw) === target);
    if (heardAsIs) {
      return { ...heardAsIs.correction, text: best.correction.text, changed: false, hideRaw: false, fixes: [], index: heardAsIs.index };
    }
  }
  return { ...best.correction, index: best.index };
}

/** JSGF hint for browsers that still honour SpeechGrammarList. Letters and spaces only. */
export function voiceGrammar(vocab: Vocabulary = defaultVocabulary()): string {
  const terms = [...new Set([...vocab.forms.keys()].map((term) => term.replace(/[^a-z ]/g, "").trim()).filter(Boolean))];
  return `#JSGF V1.0; grammar rangach; public <term> = ${terms.join(" | ")} ;`;
}
