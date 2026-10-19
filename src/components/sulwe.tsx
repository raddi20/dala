"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SulweArt, SulweStar } from "@/components/sulwe-art";
import { btnPrimary, chipClass } from "@/components/ui";
import type { Lang } from "@/lib/i18n/lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
import {
  LONG_PRESS_MS,
  SULWE_CHIPS,
  SULWE_IDLES,
  SULWE_PREVIEW_KEY,
  SULWE_MIN_SIZE,
  SULWE_SIZE,
  SULWE_TOUR_KEY,
  classifySulwePointer,
  keyboardCoversScreen,
  nextSulweReaction,
  readSulweMinimised,
  shouldShowSulwe,
  sulweDockBottom,
  sulweHaptic,
  sulweQueryOn,
  writeSulweMinimised,
  type SulweAskResult,
  type SulweReaction,
} from "@/lib/sulwe";

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

export function Sulwe({ enabled, lang }: { enabled: boolean; lang: Lang }) {
  const path = usePathname() || "/";
  const search = useSearchParams();
  const router = useRouter();
  const queryOn = sulweQueryOn(search.toString());
  const preview = useFlag("rangach-sulwe-preview", () => sessionStorage.getItem(SULWE_PREVIEW_KEY) === "1", false);
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

  const [chat, setChat] = useState(false);
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
      setChat(true);
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
          onClose={() => setChat(false)}
          onTour={showAround}
        />
      ) : (
        <div
          className="sulwe-dock fixed z-[45]"
          style={{
            right: 12,
            bottom: dock ?? "calc(4rem + env(safe-area-inset-bottom) + 10px)",
            width: minimised ? SULWE_MIN_SIZE : SULWE_SIZE,
          }}
          data-sulwe-root=""
          data-sulwe-pose={pose}
        >
          <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:bottom-full focus:right-0 focus:mb-1 focus:rounded-full focus:bg-navy focus:px-3 focus:py-2 focus:text-sm focus:text-white" onClick={() => setChat(true)}>
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
                    setChat(true);
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
          <div className="h-14 w-14 shrink-0">
            <SulweArt pose="wave" />
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
