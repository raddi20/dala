import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UI_STRINGS as STRINGS } from "@/lib/i18n/strings";
import { sulweAsk } from "@/lib/sulwe";
import {
  SULWE_LISTEN_MAX_MS,
  SULWE_MUTE_KEY,
  SULWE_PITCH,
  SULWE_RATE,
  listenOnce,
  pickSulweVoice,
  readMuted,
  readVoiceChoice,
  recognitionCtor,
  recognitionLang,
  speakSulwe,
  spokenSummary,
  sulweVoiceOn,
  voiceErrorKey,
  voiceQueryOn,
  voiceSupport,
  writeMuted,
  writeVoiceChoice,
  type ListenHandlers,
  type RecognitionLike,
} from "@/lib/sulwe-voice";

type Fired = { results: { isFinal: boolean; 0: { transcript: string } }[] };

/** A fake SpeechRecognition that records what the code asked of it. */
function fakeRecognition() {
  const made: FakeRec[] = [];
  class FakeRec implements RecognitionLike {
    lang = "";
    continuous = true;
    interimResults = false;
    maxAlternatives = 5;
    onresult: RecognitionLike["onresult"] = null;
    onerror: RecognitionLike["onerror"] = null;
    onend: RecognitionLike["onend"] = null;
    started = 0;
    stopped = 0;
    aborted = 0;
    constructor() {
      made.push(this);
    }
    start() {
      this.started += 1;
    }
    stop() {
      this.stopped += 1;
      this.onend?.();
    }
    abort() {
      this.aborted += 1;
    }
    say(fired: Fired) {
      this.onresult?.({ resultIndex: 0, results: fired.results } as never);
    }
    fail(error: string) {
      this.onerror?.({ error } as never);
      this.onend?.();
    }
  }
  return { FakeRec, made };
}

function record() {
  const log: string[] = [];
  const handlers: ListenHandlers = {
    onInterim: (text) => log.push(`interim:${text}`),
    onFinal: (text) => log.push(`final:${text}`),
    onError: (key) => log.push(`error:${key}`),
    onEnd: () => log.push("end"),
  };
  return { log, handlers };
}

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function fakeSynth(voices: { name: string; lang: string; localService?: boolean }[] = []) {
  const spoken: { text: string; pitch: number; rate: number; lang: string; voice: unknown }[] = [];
  let cancels = 0;
  class Utterance {
    text: string;
    pitch = 1;
    rate = 1;
    lang = "";
    voice: unknown = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  return {
    spoken,
    get cancels() {
      return cancels;
    },
    Utterance,
    synth: {
      cancel: () => void (cancels += 1),
      speak: (u: Utterance) => void spoken.push(u),
      getVoices: () => voices,
    },
  };
}

test("voice flag is off by default and ?voice=1 is the preview", () => {
  assert.equal(sulweVoiceOn({} as unknown as NodeJS.ProcessEnv), false);
  assert.equal(sulweVoiceOn({ NEXT_PUBLIC_SULWE_VOICE: "" } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(sulweVoiceOn({ NEXT_PUBLIC_SULWE_VOICE: "0" } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(sulweVoiceOn({ NEXT_PUBLIC_SULWE_VOICE: "1" } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(sulweVoiceOn({ NEXT_PUBLIC_SULWE_VOICE: " true " } as unknown as NodeJS.ProcessEnv), true);
  assert.equal(voiceQueryOn("?voice=1"), true);
  assert.equal(voiceQueryOn("sulwe=1&voice=1"), true);
  assert.equal(voiceQueryOn("?voice=0"), false);
  assert.equal(voiceQueryOn(""), false);
});

test("voice code is lazy: the main Sulwe file only imports the tiny flag module", () => {
  const sulwe = readFileSync("src/components/sulwe.tsx", "utf8");
  assert.match(sulwe, /dynamic\(\(\) => import\("@\/components\/sulwe-voice"\)/);
  assert.doesNotMatch(sulwe, /from "@\/lib\/sulwe-voice"/);
  assert.doesNotMatch(sulwe, /from "@\/components\/sulwe-voice"/);
  assert.match(sulwe, /voiceOn \? <SulweVoice/);
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /voice=\{sulweVoiceOn\(\)\}/);
  const flag = readFileSync("src/lib/sulwe-voice-flag.ts", "utf8");
  assert.doesNotMatch(flag, /^import /m);
});

test("unsupported browsers get no recognition, so the mic hides and the hint shows", () => {
  assert.equal(recognitionCtor({}), null);
  assert.equal(recognitionCtor(null), null);
  assert.deepEqual(voiceSupport({}), { recognition: false, synthesis: false });
  // iOS-style browser: speech out, no speech in.
  assert.deepEqual(voiceSupport({ speechSynthesis: {}, SpeechSynthesisUtterance: function () {} } as never), {
    recognition: false,
    synthesis: true,
  });
  const { FakeRec } = fakeRecognition();
  assert.equal(recognitionCtor({ webkitSpeechRecognition: FakeRec } as never), FakeRec);
  assert.equal(recognitionCtor({ SpeechRecognition: FakeRec } as never), FakeRec);
  const ui = readFileSync("src/components/sulwe-voice.tsx", "utf8");
  assert.match(ui, /if \(!support\.includes\("r"\)\)/);
  assert.match(ui, /voice_type_instead/);
  assert.match(ui, /data-sulwe-voice-unsupported/);
});

test("no listening without a tap: importing and rendering never start recognition", () => {
  const { FakeRec, made } = fakeRecognition();
  recognitionCtor({ SpeechRecognition: FakeRec } as never);
  voiceSupport({ SpeechRecognition: FakeRec } as never);
  assert.equal(made.length, 0);
  const ui = readFileSync("src/components/sulwe-voice.tsx", "utf8");
  // listenOnce is only called from the mic's tap handler.
  assert.equal(ui.match(/listenOnce\(/g)?.length, 1);
  const tap = ui.slice(ui.indexOf("function tap()"), ui.indexOf("function pickLang"));
  assert.match(tap, /listenOnce\(/);
  assert.match(ui, /onClick=\{tap\}/);
  for (const file of ["src/components/sulwe-voice.tsx", "src/lib/sulwe-voice.ts", "src/components/sulwe.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /continuous\s*=\s*true/, file);
  }
});

test("one tap listens once: not continuous, interim shown, final sent, then stopped", () => {
  const { FakeRec, made } = fakeRecognition();
  const { log, handlers } = record();
  const listener = listenOnce(FakeRec, "en-KE", handlers);
  assert.ok(listener);
  assert.equal(made.length, 1);
  const rec = made[0];
  assert.equal(rec.started, 1);
  assert.equal(rec.continuous, false);
  assert.equal(rec.interimResults, true);
  assert.equal(rec.lang, "en-KE");
  rec.say({ results: [{ isFinal: false, 0: { transcript: "fundi" } }] });
  rec.say({ results: [{ isFinal: true, 0: { transcript: "fundi Kisumu " } }] });
  assert.deepEqual(log, ["interim:fundi", "final:fundi Kisumu", "end"]);
  assert.equal(rec.stopped, 1);
  // A late result after the final is ignored.
  rec.say({ results: [{ isFinal: true, 0: { transcript: "again" } }] });
  assert.equal(log.filter((line) => line.startsWith("final")).length, 1);
});

test("second tap stops listening and ends exactly once", () => {
  const { FakeRec, made } = fakeRecognition();
  const { log, handlers } = record();
  const listener = listenOnce(FakeRec, "sw-KE", handlers)!;
  listener.stop();
  listener.abort();
  assert.equal(made[0].stopped, 1);
  assert.deepEqual(log, ["end"]);
});

test("spoken transcript goes through the same Ask parser as a typed query", async () => {
  const { FakeRec, made } = fakeRecognition();
  const asked: string[] = [];
  const listener = listenOnce(FakeRec, "en-KE", {
    onInterim: () => undefined,
    onFinal: (text) => asked.push(text),
    onError: () => undefined,
    onEnd: () => undefined,
  });
  assert.ok(listener);
  made[0].say({ results: [{ isFinal: true, 0: { transcript: "fundi Kisumu" } }] });
  const seen: string[] = [];
  const deps = {
    interpret: async (input: string) => {
      seen.push(input);
      return { city: "kisumu", region: "", category: "services", type: "", verified: false, occasion: "", hints: ["fundi"], summary: "Fundi in Kisumu" };
    },
    search: async () => ({
      hits: [
        { kind: "listing" as const, listing: { id: "a", title: "Fundi Otieno", city: "Kisumu" } },
        { kind: "listing" as const, listing: { id: "b", title: "Fundi Akinyi", city: "Kisumu" } },
        { kind: "shop" as const, shop: { slug: "fix", name: "Fix It Kisumu", city: "Kisumu" } },
      ],
    }),
  };
  const spoken = await sulweAsk(asked[0], deps);
  const typed = await sulweAsk("fundi Kisumu", deps);
  assert.deepEqual(seen, ["fundi Kisumu", "fundi Kisumu"]);
  assert.deepEqual(spoken, typed);
  assert.equal(spokenSummary("en", spoken), "I found 3 for fundi Kisumu.");
  // The chat passes the transcript to the same ask() the Send button uses.
  const sulwe = readFileSync("src/components/sulwe.tsx", "utf8");
  assert.match(sulwe, /onAsk=\{ask\}/);
});

test("permission denied and other errors give friendly messages and never stay listening", () => {
  const cases: [string, string | null][] = [
    ["not-allowed", "voice_denied"],
    ["service-not-allowed", "voice_denied"],
    ["no-speech", "voice_nospeech"],
    ["network", "voice_network"],
    ["audio-capture", "voice_nomic"],
    ["aborted", null],
    ["language-not-supported", "voice_error"],
  ];
  for (const [error, key] of cases) {
    assert.equal(voiceErrorKey(error), key, error);
    const { FakeRec, made } = fakeRecognition();
    const { log, handlers } = record();
    listenOnce(FakeRec, "en-KE", handlers);
    made[0].fail(error);
    assert.deepEqual(log, key ? [`error:${key}`, "end"] : ["end"], error);
  }
});

test("start or construct throwing still ends the listening state", () => {
  const { log, handlers } = record();
  class Broken {
    constructor() {
      throw new Error("no");
    }
  }
  assert.equal(listenOnce(Broken as never, "en-KE", handlers), null);
  assert.deepEqual(log, ["error:voice_error", "end"]);
  const second = record();
  class NoStart {
    start() {
      throw new Error("busy");
    }
    stop() {}
    abort() {}
  }
  assert.equal(listenOnce(NoStart as never, "en-KE", second.handlers), null);
  assert.deepEqual(second.log, ["error:voice_error", "end"]);
});

test("a silent browser that never fires end is cut off after the guard", () => {
  const { FakeRec, made } = fakeRecognition();
  const { log, handlers } = record();
  let pending: (() => void) | null = null;
  let waited = 0;
  listenOnce(FakeRec, "en-KE", handlers, {
    set: (fn, ms) => {
      pending = fn;
      waited = ms;
      return 1;
    },
    clear: () => {
      pending = null;
    },
  });
  assert.equal(waited, SULWE_LISTEN_MAX_MS);
  (pending as (() => void) | null)?.();
  assert.equal(made[0].aborted, 1);
  assert.deepEqual(log, ["end"]);
});

test("recognition is en-KE first, sw-KE on request, and never Dholuo", () => {
  assert.equal(recognitionLang("en", null), "en-KE");
  assert.equal(recognitionLang("en", "en"), "en-KE");
  assert.equal(recognitionLang("en", "sw"), "sw-KE");
  assert.equal(recognitionLang("dholuo", null), "en-KE");
  assert.equal(recognitionLang("dholuo", "en"), "en-KE");
  const store = memoryStore();
  assert.equal(readVoiceChoice(store), "en");
  writeVoiceChoice(store, "sw");
  assert.equal(readVoiceChoice(store), "sw");
  store.setItem("rangach_sulwe_voice_lang", "luo");
  assert.equal(readVoiceChoice(store), "en");
});

test("mute is remembered in localStorage and muted Sulwe stays quiet", () => {
  const store = memoryStore();
  assert.equal(readMuted(store), false);
  writeMuted(store, true);
  assert.equal(store.data.get(SULWE_MUTE_KEY), "1");
  assert.equal(readMuted(store), true);
  writeMuted(store, false);
  assert.equal(readMuted(store), false);
  assert.equal(readMuted(null), false);
  assert.equal(
    readMuted({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
  const fake = fakeSynth();
  assert.equal(speakSulwe(fake.synth, fake.Utterance as never, "I found 3 for fundi Kisumu.", true), false);
  assert.equal(fake.spoken.length, 0);
  assert.equal(fake.cancels, 1);
});

test("Sulwe speaks a short summary in a friendly voice, cancelling first", () => {
  const fake = fakeSynth([
    { name: "Microsoft David", lang: "en-US" },
    { name: "Google français", lang: "fr-FR" },
    { name: "Google UK English Female", lang: "en-GB" },
  ]);
  assert.equal(speakSulwe(fake.synth, fake.Utterance as never, "I found 3 for fundi Kisumu.", false), true);
  assert.equal(fake.cancels, 1);
  assert.equal(fake.spoken.length, 1);
  const said = fake.spoken[0];
  assert.equal(said.text, "I found 3 for fundi Kisumu.");
  assert.equal(said.lang, "en-GB");
  assert.equal(said.pitch, SULWE_PITCH);
  assert.equal(said.rate, SULWE_RATE);
  assert.ok(SULWE_PITCH > 1 && SULWE_PITCH < 1.5);
  assert.equal(speakSulwe(null, fake.Utterance as never, "hi", false), false);
  assert.equal(speakSulwe(fake.synth, fake.Utterance as never, "  ", false), false);
});

test("voice choice prefers en-KE, then en-GB, then any English, never other languages", () => {
  assert.equal(
    pickSulweVoice([
      { name: "Daniel", lang: "en-GB" },
      { name: "Kenya", lang: "en-KE" },
    ])?.lang,
    "en-KE",
  );
  assert.equal(
    pickSulweVoice([
      { name: "Alex", lang: "en-US" },
      { name: "Daniel", lang: "en-GB" },
    ])?.lang,
    "en-GB",
  );
  assert.equal(pickSulweVoice([{ name: "Alex", lang: "en_US" }])?.name, "Alex");
  assert.equal(pickSulweVoice([{ name: "Thomas", lang: "fr-FR" }]), null);
  assert.equal(pickSulweVoice([]), null);
  assert.equal(
    pickSulweVoice([
      { name: "Daniel", lang: "en-GB" },
      { name: "Libby", lang: "en-GB" },
    ])?.name,
    "Libby",
  );
});

test("spoken summaries stay short and never read the whole card", () => {
  const card = { title: "Fresh tilapia from Dunga beach, cleaned and packed", meta: "Kisumu", href: "/x" };
  assert.equal(spokenSummary("en", { query: "fresh tilapia", summary: "", href: "/", cards: [card] }), "I found 1 for fresh tilapia.");
  assert.equal(
    spokenSummary("dholuo", { query: "ayie catering", summary: "", href: "/", cards: [card, card] }),
    "I found 2 for ayie catering.",
  );
  assert.equal(
    spokenSummary("en", { query: "fundi Kisumu", summary: "", href: "/", cards: [] }),
    "Nothing yet for fundi Kisumu. Try a town like Kisumu.",
  );
});

test("voice strings are signed off and keep to house rules", () => {
  const voice = Object.entries(STRINGS).filter(([key]) => key.startsWith("voice_"));
  assert.ok(voice.length >= 16);
  for (const [key, row] of voice) {
    assert.equal(row.draft, false, key);
    assert.ok(row.en.trim() && row.dholuo.trim(), key);
    const text = `${row.en} ${row.dholuo}`.toLowerCase();
    assert.doesNotMatch(text, /funeral|burial|escrow/, key);
    assert.doesNotMatch(row.en, /dholuo|luo/i, `${key} never promises Dholuo recognition`);
  }
});

test("listening shows ears up, and reduced motion keeps it still", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.sulwe-listen #ears \{[^}]*transform: translateY/);
  const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .sulwe-listen #ears"));
  assert.match(motion.slice(0, 400), /animation: sulwe-ears/);
  const sulwe = readFileSync("src/components/sulwe.tsx", "utf8");
  assert.match(sulwe, /pose=\{listening \? "listen" : "wave"\}/);
});

test("Kevin's five Dholuo corrections for Sulwe voice", () => {
  assert.equal(STRINGS.voice_stop.dholuo, "We winjo");
  assert.equal(STRINGS.voice_lang.dholuo, "Voice language");
  assert.equal(STRINGS.voice_type_instead.dholuo, "Dwol ok ti e browser ni. Ndik, kaka fundi Kisumu.");
  assert.equal(STRINGS.voice_error.dholuo, "Dwol ochung. Ndik, kata tem kendo.");
  assert.equal(STRINGS.voice_mute.dholuo, "Mute Sulwe");
  for (const key of ["voice_stop", "voice_lang", "voice_type_instead", "voice_error", "voice_mute"] as const) {
    assert.equal(STRINGS[key].draft, false, key);
  }
});

test("the other eleven Sulwe voice lines stay as approved", () => {
  const approved: Record<string, string> = {
    voice_mic: "Mul, eka iwuo",
    voice_listening: "Awinjo…",
    voice_hint: "Awinjo Kisungu gi Kiswahili.",
    voice_denied: "Pod ok anyal winji. Yie ne mic, kata ndik.",
    voice_nospeech: "Ok awinjo maber. Mul mic kendo tem kendo.",
    voice_network: "Dwol dwaro intanet. Tem kendo, kata ndik.",
    voice_nomic: "Onge mic. Ndik.",
    voice_unmute: "Dwok dwond Sulwe",
    voice_found: "Ayudo {count} ne {query}.",
    voice_found_one: "Ayudo achiel ne {query}.",
    voice_none: "Pod onge ne {query}. Tem boma kaka Kisumu.",
  };
  const voice = Object.keys(STRINGS).filter((key) => key.startsWith("voice_"));
  assert.equal(voice.length, 16);
  for (const [key, dholuo] of Object.entries(approved)) {
    assert.equal(STRINGS[key as keyof typeof STRINGS].dholuo, dholuo, key);
  }
});
