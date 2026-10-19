import type { Lang } from "@/lib/i18n/lang";
import { uiFill, type StringKey } from "@/lib/i18n/strings";
import type { SulweAskResult } from "@/lib/sulwe";

export { SULWE_VOICE_PREVIEW_KEY, sulweVoiceOn, voiceQueryOn } from "@/lib/sulwe-voice-flag";

export const SULWE_MUTE_KEY = "rangach_sulwe_mute";
export const SULWE_VOICE_LANG_KEY = "rangach_sulwe_voice_lang";
/** Hard stop, so the mic can never stay on if the browser never sends "end". */
export const SULWE_LISTEN_MAX_MS = 12000;

export type VoiceChoice = "en" | "sw";

/** Recognition language. Dholuo recognition is weak, so a Dholuo page listens in Kenyan English unless SW is picked. */
export function recognitionLang(_ui: Lang, choice: VoiceChoice | null): "en-KE" | "sw-KE" {
  return choice === "sw" ? "sw-KE" : "en-KE";
}

export function readVoiceChoice(store: { getItem(key: string): string | null } | null): VoiceChoice {
  try {
    return store?.getItem(SULWE_VOICE_LANG_KEY) === "sw" ? "sw" : "en";
  } catch {
    return "en";
  }
}

export function writeVoiceChoice(store: { setItem(key: string, value: string): void } | null, choice: VoiceChoice): void {
  try {
    store?.setItem(SULWE_VOICE_LANG_KEY, choice);
  } catch {
    // Private mode. The choice lasts for this page only.
  }
}

export function readMuted(store: { getItem(key: string): string | null } | null): boolean {
  try {
    return store?.getItem(SULWE_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(store: { setItem(key: string, value: string): void } | null, muted: boolean): void {
  try {
    store?.setItem(SULWE_MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode. Mute lasts for this page only.
  }
}

/** The bits of SpeechRecognition that Sulwe uses. */
export type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type RecognitionCtor = new () => RecognitionLike;

type VoiceWindow = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  speechSynthesis?: unknown;
  SpeechSynthesisUtterance?: unknown;
};

export function recognitionCtor(win: VoiceWindow | null | undefined): RecognitionCtor | null {
  const ctor = win?.SpeechRecognition ?? win?.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as RecognitionCtor) : null;
}

export function voiceSupport(win: VoiceWindow | null | undefined): { recognition: boolean; synthesis: boolean } {
  return {
    recognition: recognitionCtor(win) !== null,
    synthesis: Boolean(win?.speechSynthesis) && typeof win?.SpeechSynthesisUtterance === "function",
  };
}

/** Friendly message for each recognition error. "aborted" after a second tap says nothing. */
export function voiceErrorKey(error: string): StringKey | null {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "voice_denied";
    case "no-speech":
      return "voice_nospeech";
    case "network":
      return "voice_network";
    case "audio-capture":
      return "voice_nomic";
    case "aborted":
      return null;
    default:
      return "voice_error";
  }
}

export type ListenHandlers = {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(key: StringKey): void;
  /** Always called once, whatever happened. The mic is off after this. */
  onEnd(): void;
};

export type Listener = { stop(): void; abort(): void };

/**
 * Listen once. One utterance, stops on silence or a result. Only call this from a tap.
 * Returns null when recognition cannot start, after calling onError and onEnd.
 */
export function listenOnce(
  ctor: RecognitionCtor,
  lang: string,
  handlers: ListenHandlers,
  timers: { set(fn: () => void, ms: number): unknown; clear(id: unknown): void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
): Listener | null {
  let ended = false;
  let heardFinal = false;
  let recognition: RecognitionLike;
  const finish = () => {
    if (ended) return;
    ended = true;
    timers.clear(guard);
    handlers.onEnd();
  };
  try {
    recognition = new ctor();
  } catch {
    handlers.onError("voice_error");
    handlers.onEnd();
    return null;
  }
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (result?.isFinal) final += text;
      else interim += text;
    }
    if (final.trim() && !heardFinal) {
      heardFinal = true;
      handlers.onFinal(final.trim());
      try {
        recognition.stop();
      } catch {
        // Already stopping.
      }
    } else if (interim.trim()) {
      handlers.onInterim(interim.trim());
    }
  };
  recognition.onerror = (event) => {
    const key = voiceErrorKey(event.error);
    if (key) handlers.onError(key);
    finish();
  };
  recognition.onend = finish;
  const guard = timers.set(() => {
    try {
      recognition.abort();
    } catch {
      // Ignore.
    }
    finish();
  }, SULWE_LISTEN_MAX_MS);
  try {
    recognition.start();
  } catch {
    handlers.onError("voice_error");
    finish();
    return null;
  }
  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        finish();
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        // Ignore.
      }
      finish();
    },
  };
}

export type VoiceLike = { name: string; lang: string; localService?: boolean };

const FRIENDLY = /female|girl|young|samantha|karen|moira|tessa|serena|libby|sonia|jenny|aria|natasha|zira|hazel|susan|google uk english/i;

/** Prefer Kenyan English, then British, then any English. A friendly, younger-sounding name wins a tie. */
export function pickSulweVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  let best: V | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const lang = voice.lang.toLowerCase().replace("_", "-");
    let score = 0;
    if (lang === "en-ke") score = 30;
    else if (lang === "en-gb") score = 20;
    else if (lang.startsWith("en")) score = 10;
    else continue;
    if (FRIENDLY.test(voice.name)) score += 5;
    if (voice.localService) score += 1;
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

export const SULWE_PITCH = 1.25;
export const SULWE_RATE = 1;

/** A short spoken reply, not the card text. Spoken in English: the voices are English. */
export function spokenSummary(_ui: Lang, result: SulweAskResult): string {
  const query = result.query.trim();
  const count = result.cards.length;
  if (count === 0) return uiFill("en", "voice_none", { query });
  if (count === 1) return uiFill("en", "voice_found_one", { query });
  return uiFill("en", "voice_found", { count, query });
}

type SynthLike = {
  cancel(): void;
  speak(utterance: unknown): void;
  getVoices(): VoiceLike[];
};

type UtteranceCtor = new (text: string) => { voice: unknown; lang: string; pitch: number; rate: number };

/** Speak the reply, cancelling anything already being said. Nothing happens while muted. */
export function speakSulwe(synth: SynthLike | null | undefined, Utterance: UtteranceCtor | null | undefined, text: string, muted: boolean): boolean {
  if (!synth || !Utterance) return false;
  synth.cancel();
  if (muted || !text.trim()) return false;
  const utterance = new Utterance(text);
  const voice = pickSulweVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "en-KE";
  utterance.pitch = SULWE_PITCH;
  utterance.rate = SULWE_RATE;
  synth.speak(utterance);
  return true;
}
