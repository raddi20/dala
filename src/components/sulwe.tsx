"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SulweArt, SulweStar } from "@/components/sulwe-art";
import { btnPrimary, chipClass } from "@/components/ui";
import type { Lang } from "@/lib/i18n/lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
import {
  LONG_PRESS_MS,
  SULWE_ASK_MAX_OPENS,
  SULWE_CHIPS,
  SULWE_IDLES,
  SULWE_PREVIEW_KEY,
  SULWE_MIN_SIZE,
  SULWE_SIZE,
  SULWE_TOUR_KEY,
  bumpSulweOpens,
  classifySulwePointer,
  keyboardCoversScreen,
  nextSulweReaction,
  placeAskLabel,
  readSulweOpens,
  readSulweMinimised,
  shouldShowAskLabel,
  shouldShowSulwe,
  sulweDockBottom,
  sulweHaptic,
  sulweQueryOn,
  writeSulweMinimised,
  type SulweAskResult,
  type SulweReaction,
} from "@/lib/sulwe";
import { SULWE_VOICE_PREVIEW_KEY, voiceQueryOn } from "@/lib/sulwe-voice-flag";

// Voice code is its own chunk, fetched only when voice is on and the chat opens.
const SulweVoice = dynamic(() => import("@/components/sulwe-voice"), { ssr: false, loading: () => null });

function useFlag(eventName: string, read: () => boolean, server: boolean) {
  return useSyncExternalStore(
    (notify) => {
      const onChange = () => notify();
      window.addEventListener(eventName, onChange);
      return () => window.removeEventListener(eventName, onChange);
    },
    read,
    () => server,
  );
}

export function Sulwe({ enabled, lang, voice = false }: { enabled: boolean; lang: Lang; voice?: boolean }) {
  const path = usePathname() || "/";
  const search = useSearchParams();
  const router = useRouter();
  const queryOn = sulweQueryOn(search.toString());
  const preview = useFlag("rangach-sulwe-preview", () => sessionStorage.getItem(SULWE_PREVIEW_KEY) === "1", false);
  const voiceQuery = voiceQueryOn(search.toString());
  const voicePreview = useFlag("rangach-sulwe-voice-preview", () => sessionStorage.getItem(SULWE_VOICE_PREVIEW_KEY) === "1", false);
  const voiceOn = voice || voiceQuery || voicePreview;
  const [listening, setListening] = useState(false);
  const onListening = useCallback((next: boolean) => setListening(next), []);
  const touring = useFlag("rangach-sulwe-tour", () => sessionStorage.getItem(SULWE_TOUR_KEY) === "1", false);
  const minimised = useFlag("rangach-sulwe-min", () => readSulweMinimised(window.localStorage), false);
  const keyboard = useFlag(
    "rangach-sulwe-viewport",
    () => keyboardCoversScreen({ innerHeight: window.innerHeight, visualHeight: window.visualViewport?.height ?? window.innerHeight }),
    false,
  );
  const hidden = useFlag("rangach-sulwe-visibility", () => document.hidden, false);
  const reduced = useFlag(
    "rangach-sulwe-motion",
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    false,
  );

  const opens = useSyncExternalStore(
    (notify) => {
      window.addEventListener("rangach-sulwe-opens", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("rangach-sulwe-opens", notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => readSulweOpens(window.localStorage),
    // Hidden on the server so a returning visitor never sees it flash.
    () => SULWE_ASK_MAX_OPENS,
  );

  const [chat, setChat] = useState(false);
  const [invite, setInvite] = useState(false);
  const [askPos, setAskPos] = useState<{ top: number; left: number; side: "left" | "above" } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const [pose, setPose] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<SulweAskResult | null>(null);
  const [dock, setDock] = useState<number | null>(null);
  const bag = useRef<readonly SulweReaction[]>([]);
  const downAt = useRef(0);
  const lastTap = useRef<number | null>(null);
  const longTimer = useRef(0);
  const poseTimer = useRef(0);
  const titleId = useId();
  const show = shouldShowSulwe({ path, flag: enabled, force: queryOn || preview, keyboard: false });
  const askVisible = shouldShowAskLabel({ show, minimised, touring, invite, chat, keyboard, opens });

  const openChat = useCallback(() => {
    try {
      bumpSulweOpens(window.localStorage);
    } catch {
      // No storage: the pill keeps showing, the chat still opens.
    }
    window.dispatchEvent(new Event("rangach-sulwe-opens"));
    setChat(true);
  }, []);

  useEffect(() => {
    if (!voiceQuery || sessionStorage.getItem(SULWE_VOICE_PREVIEW_KEY) === "1") return;
    sessionStorage.setItem(SULWE_VOICE_PREVIEW_KEY, "1");
    window.dispatchEvent(new Event("rangach-sulwe-voice-preview"));
  }, [voiceQuery]);

  useEffect(() => {
    if (!queryOn) return;
    if (sessionStorage.getItem(SULWE_PREVIEW_KEY) === "1") return;
    sessionStorage.setItem(SULWE_PREVIEW_KEY, "1");
    window.dispatchEvent(new Event("rangach-sulwe-preview"));
  }, [queryOn]);

  useEffect(() => {
    const notify = () => window.dispatchEvent(new Event("rangach-sulwe-viewport"));
    window.visualViewport?.addEventListener("resize", notify);
    window.addEventListener("resize", notify);
    const onHide = () => window.dispatchEvent(new Event("rangach-sulwe-visibility"));
    document.addEventListener("visibilitychange", onHide);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => window.dispatchEvent(new Event("rangach-sulwe-motion"));
    media.addEventListener("change", onMotion);
    return () => {
      window.visualViewport?.removeEventListener("resize", notify);
      window.removeEventListener("resize", notify);
      document.removeEventListener("visibilitychange", onHide);
      media.removeEventListener("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (!show || reduced || chat || minimised || touring) return;
    let cancelled = false;
    let timer = 0;
    const arm = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        if (!document.hidden) {
          const idle = SULWE_IDLES[Math.floor(Math.random() * SULWE_IDLES.length)] ?? "blink";
          setPose(idle);
          window.setTimeout(() => {
            if (!cancelled) setPose((current) => (current === idle ? "" : current));
          }, 900);
        }
        arm();
      }, 2400 + Math.random() * 3200);
    };
    arm();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [show, reduced, chat, minimised, touring]);

  useEffect(() => {
    if (!show || touring || chat) return;
    let frame = 0;
    const measureDock = () => {
      frame = 0;
      const tops: number[] = [];
      for (const bar of document.querySelectorAll<HTMLElement>(".bottom-nav, .sticky-cta-bar")) {
        const box = bar.getBoundingClientRect();
        if (box.width > 0 && box.height > 0 && getComputedStyle(bar).display !== "none") tops.push(box.top);
      }
      setDock(sulweDockBottom({ viewportHeight: window.innerHeight, obstacleTops: tops }));
      // The tour invite is its own speech bubble beside Sulwe. Never show two.
      setInvite(Boolean(document.querySelector("[data-tour-prompt]")));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measureDock);
    };
    measureDock();
    const late = window.setTimeout(schedule, 600);
    window.addEventListener("resize", schedule);
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
    observer?.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(late);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [show, touring, chat, path, minimised]);

  useEffect(() => {
    if (!askVisible) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const root = rootRef.current;
      const pill = askRef.current;
      if (!root || !pill) return;
      const box = root.getBoundingClientRect();
      const obstacles: { top: number; left: number; width: number; height: number }[] = [];
      for (const bar of document.querySelectorAll<HTMLElement>(".bottom-nav, .sticky-cta-bar, header.sticky, [data-sulwe-avoid]")) {
        if (getComputedStyle(bar).display === "none") continue;
        const rect = bar.getBoundingClientRect();
        obstacles.push({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }
      setAskPos(
        placeAskLabel({
          sulwe: { top: box.top, left: box.left, width: box.width, height: box.height },
          label: { width: pill.offsetWidth, height: pill.offsetHeight },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          obstacles,
        }),
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(place);
    };
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [askVisible, dock, lang, path]);

  if (!show || touring) return null;
  if (keyboard && !chat) return null;

  function rememberMin(next: boolean) {
    writeSulweMinimised(window.localStorage, next);
    window.dispatchEvent(new Event("rangach-sulwe-min"));
  }

  function playReaction() {
    const next = nextSulweReaction(bag.current);
    bag.current = next.bag;
    setPose(next.reaction);
    sulweHaptic();
    window.clearTimeout(poseTimer.current);
    poseTimer.current = window.setTimeout(() => setPose(""), 900);
  }

  function finishPointer(kind: "up" | "long") {
    window.clearTimeout(longTimer.current);
    const held = Date.now() - downAt.current;
    const since = lastTap.current === null ? null : Date.now() - lastTap.current;
    const gesture = classifySulwePointer({ kind, heldMs: kind === "long" ? LONG_PRESS_MS : held, sinceLastTapMs: since });
    if (gesture.react) playReaction();
    if (gesture.openChat) {
      lastTap.current = null;
      openChat();
      return;
    }
    if (gesture.react) lastTap.current = Date.now();
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    downAt.current = Date.now();
    window.clearTimeout(longTimer.current);
    longTimer.current = window.setTimeout(() => finishPointer("long"), LONG_PRESS_MS);
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    if (Date.now() - downAt.current >= LONG_PRESS_MS) return;
    finishPointer("up");
  }

  async function ask(query: string) {
    const text = query.trim();
    if (!text) return;
    setBusy(true);
    setDraft(text);
    try {
      const response = await fetch("/api/sulwe/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: text }),
      });
      const data = (await response.json()) as SulweAskResult;
      setResult(data.query ? data : { query: text, summary: "", href: `/listings?nl=${encodeURIComponent(text)}`, cards: [] });
    } catch {
      setResult({ query: text, summary: "", href: `/listings?nl=${encodeURIComponent(text)}`, cards: [] });
    } finally {
      setBusy(false);
    }
  }

  function showAround() {
    setChat(false);
    const params = new URLSearchParams(search.toString());
    params.set("tour", "1");
    if (queryOn || preview) params.set("sulwe", "1");
    window.dispatchEvent(new Event("rangach-tour-replay"));
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <div className="print:hidden">
      {chat ? (
        <SulweChat
          lang={lang}
          titleId={titleId}
          busy={busy}
          draft={draft}
          result={result}
          onDraft={setDraft}
          onAsk={ask}
          onClose={() => {
            setChat(false);
            setListening(false);
          }}
          onTour={showAround}
          listening={listening}
          voice={
            voiceOn ? <SulweVoice lang={lang} busy={busy} result={result} onAsk={ask} onListening={onListening} /> : null
          }
        />
      ) : (
        <>
        {askVisible ? (
          <button
            ref={askRef}
            type="button"
            className={`sulwe-ask fixed z-[45] whitespace-nowrap rounded-full border-2 border-gold bg-card px-3.5 py-2 text-sm font-semibold text-navy shadow-[0_6px_18px_rgb(20_26_36/0.2)]${askPos && !reduced ? " sulwe-ask-pop" : ""}`}
            style={askPos ? { top: askPos.top, left: askPos.left } : { top: 0, left: 0, visibility: "hidden" }}
            aria-label={uiText(lang, "sulwe_ask_label")}
            data-sulwe-ask=""
            data-sulwe-ask-side={askPos?.side ?? ""}
            onClick={openChat}
          >
            {uiText(lang, "sulwe_ask_label")}
            <span
              aria-hidden="true"
              className={`sulwe-ask-tail absolute h-3 w-3 rotate-45 border-gold bg-card ${askPos?.side === "above" ? "-bottom-[7px] right-9 border-b-2 border-r-2" : "-right-[7px] top-1/2 -mt-1.5 border-r-2 border-t-2"}`}
            />
          </button>
        ) : null}
        <div
          ref={rootRef}
          className="sulwe-dock fixed z-[45]"
          style={{
            right: 12,
            bottom: dock ?? "calc(4rem + env(safe-area-inset-bottom) + 10px)",
            width: minimised ? SULWE_MIN_SIZE : SULWE_SIZE,
          }}
          data-sulwe-root=""
          data-sulwe-pose={pose}
        >
          <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:bottom-full focus:right-0 focus:mb-1 focus:rounded-full focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:text-white" onClick={openChat}>
            {uiText(lang, "sulwe_talk")}
          </button>
          {minimised ? (
            <div className="relative" style={{ width: SULWE_MIN_SIZE, height: SULWE_MIN_SIZE }}>
              <span aria-hidden="true" className={`sulwe-halo${hidden ? " sulwe-paused" : ""}`} data-sulwe-halo="" />
              <button
                type="button"
                className="sulwe-badge relative flex h-full w-full items-center justify-center rounded-full"
                aria-label={uiText(lang, "sulwe_restore")}
                data-sulwe-restore=""
                onClick={() => rememberMin(false)}
              >
                <SulweStar className={`sulwe-min-star h-7 w-7${hidden ? " sulwe-paused" : ""}`} />
              </button>
            </div>
          ) : (
            <div className="relative" style={{ width: SULWE_SIZE, height: SULWE_SIZE }}>
              <span aria-hidden="true" className={`sulwe-halo${hidden ? " sulwe-paused" : ""}`} data-sulwe-halo="" />
              <span aria-hidden="true" className="sulwe-badge absolute inset-[6px] rounded-full" data-sulwe-badge="" />
              <button
                type="button"
                className="absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-navy text-sm font-bold text-white shadow-md"
                aria-label={uiText(lang, "sulwe_minimise")}
                data-sulwe-min=""
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => rememberMin(true)}
              >
                ×
              </button>
              <button
                type="button"
                className="relative block h-full w-full rounded-full"
                aria-label={uiText(lang, "sulwe_talk")}
                data-sulwe-tap=""
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={() => window.clearTimeout(longTimer.current)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openChat();
                  }
                }}
              >
                <span className={`sulwe-bob block h-full w-full${hidden ? " sulwe-paused" : ""}`}>
                  <SulweArt pose={pose} paused={hidden} twinkle />
                </span>
              </button>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function SulweChat({
  lang,
  titleId,
  busy,
  draft,
  result,
  onDraft,
  onAsk,
  onClose,
  onTour,
  listening = false,
  voice = null,
}: {
  lang: Lang;
  titleId: string;
  busy: boolean;
  draft: string;
  result: SulweAskResult | null;
  onDraft: (value: string) => void;
  onAsk: (query: string) => void;
  onClose: () => void;
  onTour: () => void;
  listening?: boolean;
  voice?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-navy/40" data-sulwe-chat="">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[78vh] w-full overflow-y-auto rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start gap-3">
          <div className={`h-14 w-14 shrink-0${listening ? " sulwe-listening rounded-full" : ""}`} data-sulwe-chat-art="">
            <SulweArt pose={listening ? "listen" : "wave"} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-xl text-navy">
              {uiText(lang, "sulwe_chat")}
            </h2>
            <p className="text-base leading-relaxed text-ink/80">{uiText(lang, "sulwe_hi")}</p>
          </div>
          <button type="button" className="min-h-11 px-2 text-base font-semibold text-navy" onClick={onClose}>
            {uiText(lang, "sulwe_close")}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SULWE_CHIPS.map((chip) => (
            <button key={chip.id} type="button" className={chipClass} data-sulwe-chip={chip.id} onClick={() => onAsk(chip.query)}>
              {uiText(lang, chip.label)}
            </button>
          ))}
        </div>
        {voice}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onAsk(draft);
          }}
        >
          <label className="sr-only" htmlFor="sulwe-ask">
            {uiText(lang, "sulwe_placeholder")}
          </label>
          <input
            id="sulwe-ask"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            placeholder={uiText(lang, "sulwe_placeholder")}
            className="min-h-11 flex-1 rounded-full border border-line bg-white px-4 text-base"
          />
          <button type="submit" className={`${btnPrimary} px-4`} disabled={busy}>
            {uiText(lang, "sulwe_send")}
          </button>
        </form>
        {busy ? <p className="mt-3 text-sm text-muted">{uiText(lang, "sulwe_searching")}</p> : null}
        {result && !busy ? <SulweAnswer lang={lang} result={result} /> : null}
        <button type="button" className="mt-4 inline-flex min-h-11 items-center font-semibold text-navy" data-sulwe-tour="" onClick={onTour}>
          {uiText(lang, "tour_replay")}
        </button>
      </div>
    </div>
  );
}

function SulweAnswer({ lang, result }: { lang: Lang; result: SulweAskResult }) {
  return (
    <div className="mt-4" data-sulwe-answer="">
      <p className="text-base text-ink">{uiFill(lang, "sulwe_found", { query: result.query })}</p>
      <p className="mt-1 text-sm font-semibold text-navy">{uiText(lang, "understood")}</p>
      {result.summary ? <p className="text-sm text-muted">{result.summary}</p> : null}
      {result.cards.length === 0 ? <p className="mt-2 text-base text-ink/80">{uiText(lang, "sulwe_empty")}</p> : null}
      <ul className="mt-2 grid gap-2">
        {result.cards.map((card) => (
          <li key={card.href}>
            <a href={card.href} className="block rounded-2xl border border-line bg-white px-3 py-2">
              <span className="block font-semibold text-navy">{card.title}</span>
              {card.meta ? <span className="text-sm text-muted">{card.meta}</span> : null}
            </a>
          </li>
        ))}
      </ul>
      <a href={result.href} className="mt-3 inline-flex min-h-11 items-center font-semibold text-lake">
        {uiText(lang, "sulwe_see_all")}
      </a>
    </div>
  );
}
