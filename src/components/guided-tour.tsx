"use client";

import { useCallback, useEffect, useId, useSyncExternalStore, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { btnPrimary } from "@/components/ui";
import type { Lang } from "@/lib/i18n/lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
import {
  advanceTour,
  parseTourRecord,
  persistTourRecord,
  readTourRecord,
  replayTour,
  serializeTourRecord,
  shouldShowTour,
  skipTour,
  stepsForKind,
  storageKeyForKind,
  tourBody,
  tourKindForPath,
  tourQueryOn,
  visibleTourBox,
  type TourBox,
  type TourRecord,
} from "@/lib/tour";

type Spot = { top: number; left: number; width: number; height: number } | null;

export function TourCard({
  lang,
  title,
  body,
  step,
  total,
  last,
  onNext,
  onSkip,
}: {
  lang: Lang;
  title: string;
  body: string;
  step: number;
  total: number;
  last: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="w-full rounded-2xl bg-card p-4 text-ink shadow-2xl"
    >
      <p className="sr-only">{uiFill(lang, "tour_step", { n: step + 1, total })}</p>
      <h2 id={titleId} className="font-serif text-xl text-navy">
        {title}
      </h2>
      <p id={bodyId} className="mt-1 text-base leading-relaxed text-ink/80">
        {body}
      </p>
      <div className="mt-3 flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            data-tour-dot=""
            className={`h-2.5 w-2.5 rounded-full ${index === step ? "bg-navy" : "bg-line"}`}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onSkip} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-base font-semibold text-navy">
          {uiText(lang, "tour_skip")}
        </button>
        <button type="button" onClick={onNext} className={`${btnPrimary} min-h-11 flex-1 px-4 text-base`}>
          {last ? uiText(lang, "tour_done") : uiText(lang, "tour_next")}
        </button>
      </div>
    </div>
  );
}

function measure(target: string): { spot: Spot; bubbleTop: number; bubbleLeft: number } {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`));
  const candidate = nodes.find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width >= 2 && rect.height >= 2;
  });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (candidate && !reduce) candidate.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  const rect = candidate?.getBoundingClientRect();
  const boxes: TourBox[] = rect
    ? [{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }]
    : [];
  const box = visibleTourBox(boxes, { width: window.innerWidth, height: window.innerHeight });
  const width = Math.min(336, window.innerWidth - 24);
  const bubbleLeft = Math.max(12, Math.min(window.innerWidth - width - 12, box ? box.left : (window.innerWidth - width) / 2));
  if (!box) {
    return { spot: null, bubbleTop: Math.max(12, (window.innerHeight - 220) / 2), bubbleLeft };
  }
  const spot = { top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 };
  const bubbleHeight = 220;
  const below = spot.top + spot.height + 12;
  const above = spot.top - bubbleHeight - 12;
  const preferred = below + bubbleHeight < window.innerHeight - 12 ? below : above;
  const bubbleTop = Math.min(Math.max(12, preferred), Math.max(12, window.innerHeight - bubbleHeight - 12));
  return { spot, bubbleTop, bubbleLeft };
}

export function GuidedTour({ enabled, lang }: { enabled: boolean; lang: Lang }) {
  const path = usePathname() || "/";
  const search = useSearchParams();
  const force = tourQueryOn(search.toString());
  const kind = tourKindForPath(path);
  const steps = stepsForKind(kind);
  const key = storageKeyForKind(kind);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [spot, setSpot] = useState<Spot>(null);
  const [bubbleTop, setBubbleTop] = useState(24);
  const [bubbleLeft, setBubbleLeft] = useState(12);
  const subscribe = useCallback((notify: () => void) => {
    function onChange() {
      notify();
    }
    function onReplay() {
      document.cookie = persistTourRecord(window.localStorage, key, replayTour());
      setClosedFor(null);
      notify();
    }
    window.addEventListener("rangach-tour-change", onChange);
    window.addEventListener("rangach-tour-replay", onReplay);
    return () => {
      window.removeEventListener("rangach-tour-change", onChange);
      window.removeEventListener("rangach-tour-replay", onReplay);
    };
  }, [key, setClosedFor]);
  const raw = useSyncExternalStore(
    subscribe,
    () => serializeTourRecord(readTourRecord(window.localStorage, document.cookie, key)),
    () => "seen",
  );
  const record = parseTourRecord(raw);
  const sessionClosed = closedFor === key;
  const open = !sessionClosed && shouldShowTour({ path, flag: enabled, force, seen: record.seen });
  const stepIndex = Math.min(record?.step ?? 0, steps.length - 1);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!open || !step) return;
    const place = () => {
      const next = measure(step.target);
      setSpot(next.spot);
      setBubbleTop(next.bubbleTop);
      setBubbleLeft(next.bubbleLeft);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const dialog = document.querySelector<HTMLElement>("[data-tour-dialog]");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.querySelector<HTMLElement>("button:last-of-type")?.focus();
    function finish(next: TourRecord) {
      document.cookie = persistTourRecord(window.localStorage, key, next);
      if (next.seen) setClosedFor(key);
      window.dispatchEvent(new Event("rangach-tour-change"));
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(skipTour());
      }
      if (event.key !== "Tab" || !dialog) return;
      const buttons = Array.from(dialog.querySelectorAll<HTMLElement>("button"));
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, key, stepIndex]);

  if (!open || !step) return null;

  function commit(next: TourRecord) {
    document.cookie = persistTourRecord(window.localStorage, key, next);
    if (next.seen) setClosedFor(key);
    window.dispatchEvent(new Event("rangach-tour-change"));
  }

  return (
    <div className="print:hidden" data-tour-layer="">
      <div className="fixed inset-0 z-[80]" aria-hidden="true" />
      {spot ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[81] rounded-2xl"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgb(11 22 40 / 0.55)",
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[81] bg-navy/55" aria-hidden="true" />
      )}
      <div className="fixed z-[82] w-[min(21rem,calc(100vw-1.5rem))]" style={{ top: bubbleTop, left: bubbleLeft }} data-tour-dialog="">
        <TourCard
          lang={lang}
          title={uiText(lang, step.title)}
          body={tourBody(lang, step)}
          step={stepIndex}
          total={steps.length}
          last={stepIndex === steps.length - 1}
          onSkip={() => commit(skipTour())}
          onNext={() => commit(advanceTour(record, steps.length))}
        />
      </div>
    </div>
  );
}
