import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UI_STRINGS } from "@/lib/i18n/strings";
import { OCCASION_DEFINITIONS } from "@/lib/occasions";
import { TOWNS } from "@/lib/constants";
import { listenOnce, addGrammarHint, SULWE_ALTERNATIVES, type HeardAlternative, type RecognitionLike } from "@/lib/sulwe-voice";
import {
  MISHEARINGS,
  OCCASION_WORDS,
  buildVocabulary,
  correctTranscript,
  defaultVocabulary,
  displaySafe,
  editDistance,
  normaliseText,
  phoneticKey,
  pickBestAlternative,
  voiceGrammar,
} from "@/lib/voice-correct";
import { catalogueKeywords } from "@/lib/voice-vocab";

const fixed = (text: string) => correctTranscript(text).text;

test("every hand-mapped mishearing becomes fundi, ayie, tilapia or dowry", () => {
  const targets = new Set(["fundi", "ayie", "tilapia", "dowry"]);
  for (const entry of MISHEARINGS) {
    assert.ok(targets.has(entry.to), entry.heard);
    const said = entry.needsContext ? `${entry.heard} Kisumu` : entry.heard;
    const result = correctTranscript(said);
    assert.equal(result.changed, true, said);
    assert.ok(normaliseText(result.text).split(" ").includes(entry.to), `${said} → ${result.text}`);
  }
});

test("fundi mishearings, as Kevin's phone heard them", () => {
  for (const said of ["fun guy", "Fun guy", "fungi", "fun day Kisumu", "fundy", "phone D", "Phone D.", "gay guy", "fun guys", "fondi", "fun dee"]) {
    assert.match(fixed(said), /^fundi\b/, said);
  }
  assert.equal(fixed("fun guy Kisumu"), "fundi Kisumu");
  assert.equal(fixed("gay guy in Kisumu"), "fundi in Kisumu");
  assert.equal(fixed("phone D Kosele"), "fundi Kosele");
});

test("ayie, tilapia, rech ngege and dowry mishearings", () => {
  for (const said of ["I.E.", "i.e. catering", "aye catering", "I a catering", "eye-ye", "eye yay tents", "ayee"]) {
    assert.match(fixed(said), /^ayie\b/, said);
  }
  for (const said of ["tilapya", "till APIA", "fresh till apia", "tila pia", "tilapiya", "tea lapia"]) {
    assert.match(fixed(said), /tilapia/, said);
  }
  for (const said of ["rech ngege", "reach ngege", "rich ngege Bondo", "rech gege", "ngege"]) {
    assert.match(fixed(said), /tilapia/, said);
  }
  for (const said of ["dowery", "dowr y", "dawry", "dowri", "dow ry"]) {
    assert.match(fixed(said), /^dowry$/, said);
  }
});

test("towns are fuzzy-matched by sound and spelling", () => {
  assert.equal(fixed("fundi kisumo"), "fundi Kisumu");
  assert.equal(fixed("key sumo plumber"), "Kisumu plumber");
  assert.equal(fixed("homer bay tents"), "Homa Bay tents");
  assert.equal(fixed("home a bay"), "Homa Bay");
  assert.equal(fixed("sea ya fundi"), "Siaya fundi");
  assert.equal(fixed("condelle salon"), "Kondele salon");
  assert.equal(fixed("nakuro"), "Nakuru");
  assert.equal(fixed("eldorett"), "Eldoret");
  assert.equal(fixed("tilapia in kosely"), "tilapia in Kosele");
  // Spelled right: untouched, not flagged as a correction.
  for (const said of ["fundi Kisumu", "tilapia in Bondo", "Kendu Bay", "catering in Oyugis", "ayie in Siaya"]) {
    const result = correctTranscript(said);
    assert.equal(result.changed, false, said);
    assert.equal(result.text, said);
  }
});

test("ordinary phrases are never forced into the vocabulary", () => {
  for (const said of [
    "I am looking for a house",
    "birthday cake",
    "eye doctor in Nairobi",
    "band for wedding",
    "plumbers in Nairobi",
    "I want pizza",
    "what is the weather tomorrow",
    "fun day",
    "fun day out",
    "I a",
    "phoned my sister",
    "good food near me",
    "car hire",
    "bond",
    "kissy",
    "second hand phones",
    "music for a party",
  ]) {
    const result = correctTranscript(said);
    assert.equal(result.changed, false, `${said} → ${result.text}`);
    assert.equal(result.text, said);
  }
});

test("best of five: corrected alternatives compete, and a clean guess wins outright", () => {
  // The first guess is rude, the third heard it right: no correction is shown.
  const clean = pickBestAlternative([
    { transcript: "gay guy Kisumu", confidence: 0.92 },
    { transcript: "fun guy Kisumu", confidence: 0.5 },
    { transcript: "fundi Kisumu", confidence: 0.31 },
  ]);
  assert.equal(clean?.text, "fundi Kisumu");
  assert.equal(clean?.changed, false);
  assert.equal(clean?.index, 2);
  // Only mishearings: the best one is fixed and offered as Did you mean.
  const fixedPick = pickBestAlternative([
    { transcript: "fun guy kiss you moo", confidence: 0.8 },
    { transcript: "fun guy Kisumu", confidence: 0.7 },
  ]);
  assert.equal(fixedPick?.text, "fundi Kisumu");
  assert.equal(fixedPick?.changed, true);
  assert.equal(fixedPick?.raw, "fun guy Kisumu");
  // A Rangach word lifts a lower guess over a higher one with none.
  const words = pickBestAlternative([
    { transcript: "fresh till a pier", confidence: 0.6 },
    { transcript: "fresh tilapia", confidence: 0.45 },
  ]);
  assert.equal(words?.text, "fresh tilapia");
  assert.equal(words?.changed, false);
  // Chrome often gives later guesses confidence 0. Order still counts.
  const zero = pickBestAlternative([
    { transcript: "plumber in Nairobi", confidence: 0 },
    { transcript: "plumber in Nairobi please", confidence: 0 },
  ]);
  assert.equal(zero?.index, 0);
  // Plain speech stays plain.
  assert.equal(pickBestAlternative([{ transcript: "birthday cake", confidence: 0.9 }])?.changed, false);
  assert.equal(pickBestAlternative([{ transcript: "  " }]), null);
  assert.equal(pickBestAlternative([]), null);
});

test("rude or awkward mishearings never reach the screen", () => {
  const rude = correctTranscript("gay guy Kisumu");
  assert.equal(rude.text, "fundi Kisumu");
  assert.equal(rude.hideRaw, true);
  assert.equal(correctTranscript("reach and gay gay").hideRaw, true);
  assert.equal(correctTranscript("fun guy Kisumu").hideRaw, false);
  // Live half-heard words are cleaned too.
  assert.equal(displaySafe("gay guy"), "fundi");
  assert.equal(displaySafe("gay guy Kisumu"), "fundi kisumu");
  assert.doesNotMatch(displaySafe("so gay"), /gay/);
  assert.equal(displaySafe("fundi Kisumu"), "fundi Kisumu");
  const pick = pickBestAlternative([{ transcript: "gay guy Kisumu", confidence: 0.9 }]);
  assert.equal(pick?.hideRaw, true);
  assert.equal(pick?.text, "fundi Kisumu");
  const ui = readFileSync("src/components/sulwe-voice.tsx", "utf8");
  assert.match(ui, /suggestion\.hideRaw \? null : \(\s*<p[^>]*data-sulwe-suggest-raw-text/);
  assert.match(ui, /suggestion\.hideRaw \? null : \(\s*<button[^>]*data-sulwe-suggest-raw=/);
  assert.match(ui, /onInterim: \(text\) => setHeard\(displaySafe\(text\)\)/);
});

test("phonetic key and edit distance", () => {
  assert.equal(phoneticKey("fundi"), phoneticKey("fundy"));
  assert.equal(phoneticKey("kisumu"), phoneticKey("keysumo"));
  assert.equal(phoneticKey("homabay"), phoneticKey("homerbay"));
  assert.equal(phoneticKey("kondele"), phoneticKey("condelle"));
  assert.notEqual(phoneticKey("kisumu"), phoneticKey("nairobi"));
  assert.equal(phoneticKey(""), "");
  assert.equal(editDistance("kisumu", "kisumo"), 1);
  assert.equal(editDistance("", "abc"), 3);
  assert.equal(normaliseText("I.E., Kisumu!"), "i e kisumu");
});

test("vocabulary covers towns, occasions and keywords, from config", () => {
  const vocab = defaultVocabulary();
  for (const town of TOWNS) assert.ok(vocab.forms.has(normaliseText(town.name)), town.name);
  for (const word of ["kondele", "fundi", "ayie", "dowry", "tilapia", "catering", "plumber", "wedding", "christmas", "homecoming"]) {
    assert.ok(vocab.forms.has(word), word);
  }
  const titles = OCCASION_DEFINITIONS.map((occasion) => occasion.title.toLowerCase()).join(" ");
  for (const word of OCCASION_WORDS) assert.ok(titles.includes(word.replace(/s$/, "")), word);
  // Catalogue words are added on top.
  assert.ok(buildVocabulary(["sukuma"]).forms.has("sukuma"));
  assert.ok(voiceGrammar(vocab).startsWith("#JSGF V1.0; grammar rangach; public <term> = "));
  assert.doesNotMatch(voiceGrammar(vocab), /[^a-zA-Z0-9 #.;<>=|]/);
});

test("catalogue keywords drop seller names, numbers and contact details", () => {
  const words = catalogueKeywords({
    titles: [
      "Fundi Otieno plumbing",
      "Otieno plumbing and repairs",
      "Fresh tilapia from Dunga",
      "Fresh tilapia daily",
      "Tilapia and omena",
      "Akinyi's tiles and masonry",
      "Akinyis masonry works",
      "Call 0712345678 for masonry",
      "mail me a@b.co masonry",
      "Wanjiru one-off bakery",
    ],
    personalNames: ["Otieno Ouma", "Akinyi Achieng"],
  });
  assert.deepEqual(words.slice(0, 3), ["tilapia", "masonry", "plumbing"]);
  for (const name of ["otieno", "akinyi", "akinyis", "wanjiru"]) assert.equal(words.includes(name), false, name);
  assert.equal(words.includes("bakery"), false, "one title is not enough");
  assert.equal(words.some((word) => /\d|@/.test(word)), false);
  const many = Array.from({ length: 4 }, () => "sukuma omena chapati mandazi");
  assert.equal(catalogueKeywords({ titles: many, personalNames: [] }, 2).length, 2);
  const route = readFileSync("src/app/api/sulwe/vocab/route.ts", "utf8");
  assert.match(route, /Cache-Control/);
  assert.match(route, /max-age=600/);
});

type Fired = { results: (Array<{ transcript: string; confidence?: number }> & { isFinal: boolean })[] };

function fakeRecognition() {
  const made: FakeRec[] = [];
  class FakeRec implements RecognitionLike {
    lang = "";
    continuous = true;
    interimResults = false;
    maxAlternatives = 1;
    grammars?: unknown;
    onresult: RecognitionLike["onresult"] = null;
    onerror: RecognitionLike["onerror"] = null;
    onend: RecognitionLike["onend"] = null;
    constructor() {
      made.push(this);
    }
    start() {}
    stop() {
      this.onend?.();
    }
    abort() {}
    say(fired: Fired) {
      this.onresult?.({ resultIndex: 0, results: fired.results } as never);
    }
  }
  return { FakeRec, made };
}

const final = (options: { transcript: string; confidence?: number }[]) => Object.assign(options, { isFinal: true });

test("voice flow with mocked recognition: five guesses in, the right search out", () => {
  const { FakeRec, made } = fakeRecognition();
  const asked: string[] = [];
  const suggested: string[] = [];
  let got: HeardAlternative[] = [];
  listenOnce(FakeRec, "en-KE", {
    onInterim: () => undefined,
    onFinal: (text, alternatives) => {
      got = alternatives;
      const pick = pickBestAlternative(alternatives)!;
      if (pick.changed) suggested.push(pick.text);
      else asked.push(pick.text);
    },
    onError: () => undefined,
    onEnd: () => undefined,
  });
  assert.equal(made[0].maxAlternatives, SULWE_ALTERNATIVES);
  assert.equal(SULWE_ALTERNATIVES, 5);
  made[0].say({
    results: [
      final([
        { transcript: "fun guy Kisumu", confidence: 0.8 },
        { transcript: "fungi Kisumu", confidence: 0.1 },
        { transcript: "phone D Kisumu", confidence: 0.05 },
      ]),
    ],
  });
  assert.equal(got.length, 3);
  assert.deepEqual(asked, []);
  assert.deepEqual(suggested, ["fundi Kisumu"]);

  const second = fakeRecognition();
  listenOnce(second.FakeRec, "en-KE", {
    onInterim: () => undefined,
    onFinal: (text, alternatives) => {
      const pick = pickBestAlternative(alternatives)!;
      (pick.changed ? suggested : asked).push(pick.text);
    },
    onError: () => undefined,
    onEnd: () => undefined,
  });
  second.made[0].say({ results: [final([{ transcript: "tilapia in Bondo", confidence: 0.9 }])] });
  assert.deepEqual(asked, ["tilapia in Bondo"]);
});

test("a corrected search waits for a tap; a clean one searches at once", () => {
  const ui = readFileSync("src/components/sulwe-voice.tsx", "utf8");
  const final = ui.slice(ui.indexOf("function heardFinal"), ui.indexOf("function pickLang"));
  assert.match(final, /if \(!pick\.changed\) \{\s*search\(pick\.text\);\s*return;\s*\}/);
  assert.match(final, /setSuggestion\(pick\)/);
  assert.doesNotMatch(final.slice(final.indexOf("setSuggestion(pick)")), /onAsk|search\(/);
  assert.doesNotMatch(ui, /setTimeout|setInterval/);
  assert.match(ui, /data-sulwe-suggest-yes="" onClick=\{\(\) => search\(suggestion\.text\)\}/);
  assert.match(ui, /data-sulwe-suggest-raw="" onClick=\{\(\) => search\(suggestion\.raw\)\}/);
  // Sulwe says the corrected words, never the raw ones.
  assert.match(final, /hear_did_you_mean", \{ query: pick\.text \}/);
});

test("grammar hint is used where it exists and never breaks browsers without it", () => {
  const rec = { grammars: undefined } as unknown as RecognitionLike;
  assert.equal(addGrammarHint(rec, "#JSGF V1.0;", null), false);
  assert.equal(addGrammarHint(rec, "#JSGF V1.0;", {}), false);
  const added: string[] = [];
  class List {
    addFromString(text: string) {
      added.push(text);
    }
  }
  assert.equal(addGrammarHint(rec, "#JSGF V1.0;", { webkitSpeechGrammarList: List }), true);
  assert.deepEqual(added, ["#JSGF V1.0;"]);
  assert.ok(rec.grammars instanceof List);
  class Throws {
    constructor() {
      throw new Error("not here");
    }
  }
  assert.equal(addGrammarHint({} as RecognitionLike, "#JSGF V1.0;", { SpeechGrammarList: Throws }), false);
  // listenOnce still starts when the grammar list throws.
  const { FakeRec, made } = fakeRecognition();
  const listener = listenOnce(
    FakeRec,
    "en-KE",
    { onInterim: () => undefined, onFinal: () => undefined, onError: () => undefined, onEnd: () => undefined },
    { grammar: "#JSGF V1.0;", win: { SpeechGrammarList: Throws } },
  );
  assert.ok(listener);
  assert.equal(made.length, 1);
});

test("hear_ strings are signed off with the exact approved text and never rude", () => {
  const keys = Object.keys(UI_STRINGS).filter((key) => key.startsWith("hear_"));
  assert.deepEqual(keys, ["hear_did_you_mean", "hear_search_this", "hear_search_said", "hear_heard"]);
  const approved: Record<string, [string, string]> = {
    hear_did_you_mean: ["Did you mean: {query}?", "Ne idwaro wacho ni: {query}?"],
    hear_search_this: ["Search this", "Manyo ma"],
    hear_search_said: ["Search what I said", "Manyo gima ne awacho"],
    hear_heard: ["I heard: {raw}", "Ne awinjo: {raw}"],
  };
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, false, key);
    assert.match(row.notes, /^Kevin signed off\./, key);
    assert.equal(row.en, approved[key][0], key);
    assert.equal(row.dholuo, approved[key][1], key);
    assert.doesNotMatch(`${row.en} ${row.dholuo}`, /gay|escrow/i, key);
  }
});
