"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n/lang";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { uiFill, uiText, type StringKey } from "@/lib/i18n/strings";
import type { SulweAskResult } from "@/lib/sulwe";
import {
  listenOnce,
  readMuted,
  readVoiceChoice,
  recognitionCtor,
  recognitionLang,
  speakSulwe,
  spokenSummary,
  voiceSupport,
  writeMuted,
  writeVoiceChoice,
  type HeardAlternative,
  type Listener,
  type VoiceChoice,
} from "@/lib/sulwe-voice";
import { buildVocabulary, defaultVocabulary, displaySafe, pickBestAlternative, voiceGrammar, type Vocabulary, type VoicePick } from "@/lib/voice-correct";

let catalogueWords: Promise<string[]> | null = null;

/** Catalogue words, fetched once per page load. The chat works without them. */
function loadCatalogueWords(): Promise<string[]> {
  catalogueWords ??= fetch("/api/sulwe/vocab")
    .then((response) => (response.ok ? response.json() : { words: [] }))
    .then((body: { words?: unknown }) => (Array.isArray(body.words) ? body.words.filter((word): word is string => typeof word === "string") : []))
    .catch(() => []);
  return catalogueWords;
}

const MUTE_EVENT = "rangach-sulwe-mute";
const LANG_EVENT = "rangach-sulwe-voice-lang";

type VoiceWindow = Window & {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  SpeechSynthesisUtterance?: unknown;
};

function synth() {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function useStored<T>(event: string, read: () => T, server: T): T {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener(event, notify);
      return () => window.removeEventListener(event, notify);
    },
    read,
    () => server,
  );
}

const noSubscribe = () => () => undefined;

/** Tap-to-talk for Sulwe's chat. Loaded only when the voice flag or ?voice=1 is on. */
export default function SulweVoice({
  lang,
  busy,
  result,
  onAsk,
  onListening,
}: {
  lang: Lang;
  busy: boolean;
  result: SulweAskResult | null;
  onAsk: (query: string) => void;
  onListening: (listening: boolean) => void;
}) {
  const support = useSyncExternalStore(
    noSubscribe,
    () => {
      const found = voiceSupport(window as VoiceWindow);
      return `${found.recognition ? "r" : ""}${found.synthesis ? "s" : ""}` || "none";
    },
    () => "unknown",
  );
  const muted = useStored(MUTE_EVENT, () => readMuted(window.localStorage), false);
  const choice = useStored<VoiceChoice>(LANG_EVENT, () => readVoiceChoice(window.localStorage), "en");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [message, setMessage] = useState<StringKey | null>(null);
  const listener = useRef<Listener | null>(null);
  const pending = useRef<string | null>(null);
  const [suggestion, setSuggestion] = useState<VoicePick | null>(null);
  const vocab = useRef<Vocabulary>(defaultVocabulary());

  useEffect(() => {
    let live = true;
    void loadCatalogueWords().then((words) => {
      if (live && words.length) vocab.current = buildVocabulary(words);
    });
    return () => {
      live = false;
    };
  }, []);

  // Never leave the mic on or keep talking after the chat closes.
  useEffect(
    () => () => {
      listener.current?.abort();
      synth()?.cancel();
    },
    [],
  );

  useEffect(() => {
    onListening(listening);
  }, [listening, onListening]);

  // A new question (typed or spoken) stops whatever he was saying.
  useEffect(() => {
    if (busy) synth()?.cancel();
  }, [busy]);

  // Reply out loud only to the question that was spoken.
  useEffect(() => {
    if (busy || !result || pending.current === null) return;
    if (result.query.trim().toLowerCase() !== pending.current.trim().toLowerCase()) return;
    pending.current = null;
    const win = window as VoiceWindow;
    speakSulwe(synth(), win.SpeechSynthesisUtterance as never, spokenSummary(lang, result), muted);
  }, [busy, result, lang, muted]);

  if (support === "unknown") return null;
  if (!support.includes("r")) {
    return (
      <p className="mt-3 rounded-2xl bg-sand/60 px-3 py-2 text-sm text-ink/80" data-sulwe-voice-unsupported="">
        {uiText(lang, "voice_type_instead")}
      </p>
    );
  }

  function tap() {
    if (listener.current) {
      listener.current.stop();
      return;
    }
    const ctor = recognitionCtor(window as VoiceWindow);
    if (!ctor) return;
    synth()?.cancel();
    setMessage(null);
    setHeard("");
    setSuggestion(null);
    let grammar = "";
    try {
      grammar = voiceGrammar(vocab.current);
    } catch {
      grammar = "";
    }
    setListening(true);
    listener.current = listenOnce(
      ctor,
      recognitionLang(lang, choice),
      {
        onInterim: (text) => setHeard(displaySafe(text)),
        onFinal: (text, alternatives) => heardFinal(text, alternatives),
        onError: (key) => setMessage(key),
        onEnd: () => {
          listener.current = null;
          setListening(false);
        },
      },
      { grammar, win: window as never },
    );
  }

  function search(text: string) {
    setSuggestion(null);
    setHeard(displaySafe(text));
    pending.current = text;
    onAsk(text);
  }

  /** Clear speech searches straight away. A corrected one waits for a tap on Search this. */
  function heardFinal(text: string, alternatives: HeardAlternative[]) {
    const pick = pickBestAlternative(alternatives.length ? alternatives : [{ transcript: text }], vocab.current);
    if (!pick) return;
    if (!pick.changed) {
      search(pick.text);
      return;
    }
    setHeard("");
    setSuggestion(pick);
    const win = window as VoiceWindow;
    speakSulwe(synth(), win.SpeechSynthesisUtterance as never, uiFill("en", "hear_did_you_mean", { query: pick.text }), muted);
  }

  function pickLang(next: VoiceChoice) {
    writeVoiceChoice(window.localStorage, next);
    window.dispatchEvent(new Event(LANG_EVENT));
  }

  function toggleMute() {
    const next = !muted;
    writeMuted(window.localStorage, next);
    if (next) synth()?.cancel();
    window.dispatchEvent(new Event(MUTE_EVENT));
  }

  const status = listening ? (heard ? `“${heard}”` : uiText(lang, "voice_listening")) : message ? uiText(lang, message) : heard ? `“${heard}”` : "";

  return (
    <div className="mt-3" data-sulwe-voice="" data-listening={listening ? "1" : "0"}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`sulwe-mic relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gold-l text-white shadow-md ${
            listening ? "sulwe-mic-live bg-navy" : "bg-gold-d"
          }`}
          aria-label={uiText(lang, listening ? "voice_stop" : "voice_mic")}
          aria-pressed={listening}
          data-sulwe-mic=""
          onClick={tap}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 text-base text-ink" aria-live="polite" data-sulwe-heard="">
          {status || <span className="text-sm text-muted">{uiText(lang, "voice_mic")}</span>}
        </p>
        {support.includes("s") ? (
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-navy"
            aria-label={uiText(lang, muted ? "voice_unmute" : "voice_mute")}
            aria-pressed={muted}
            data-sulwe-mute={muted ? "1" : "0"}
            onClick={toggleMute}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
              {muted ? (
                <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        ) : null}
      </div>
      {suggestion ? (
        <div className="mt-3 rounded-2xl border border-gold-l bg-sand/50 p-3" data-sulwe-suggest="" role="group" aria-live="polite">
          <p className="text-base text-ink" data-sulwe-suggest-text="">
            {uiFill(lang, "hear_did_you_mean", { query: suggestion.text })}
          </p>
          {suggestion.hideRaw ? null : (
            <p className="mt-1 text-xs text-muted" data-sulwe-suggest-raw-text="">
              {uiFill(lang, "hear_heard", { raw: suggestion.raw })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={`${btnPrimary} min-h-11`} data-sulwe-suggest-yes="" onClick={() => search(suggestion.text)}>
              {uiText(lang, "hear_search_this")}
            </button>
            {suggestion.hideRaw ? null : (
              <button type="button" className={`${btnSecondary} min-h-11`} data-sulwe-suggest-raw="" onClick={() => search(suggestion.raw)}>
                {uiText(lang, "hear_search_said")}
              </button>
            )}
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span>{uiText(lang, "voice_hint")}</span>
        <span role="group" aria-label={uiText(lang, "voice_lang")} className="ml-auto inline-flex overflow-hidden rounded-full border border-line">
          {(["en", "sw"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={choice === code}
              data-sulwe-voice-lang={code}
              className={`min-h-8 px-2.5 font-semibold ${choice === code ? "bg-navy text-white" : "bg-white text-navy"}`}
              onClick={() => pickLang(code)}
              disabled={listening}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}
