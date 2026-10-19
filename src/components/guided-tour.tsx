"use client";

import { useEffect, useId, useRef, useSyncExternalStore, useState, type CSSProperties, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SulweArt, SulweSparkArt, SulweWandArt } from "@/components/sulwe-art";
import { btnPrimary } from "@/components/ui";
import type { Lang } from "@/lib/i18n/lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
import {
  SULWE_PREVIEW_KEY,
  SULWE_TOUR_KEY,
  SULWE_TOUR_SIZE,
  SULWE_VOILA_MS,
  placeSulwe,
  sulweQueryOn,
  sulweWand,
  type SulweSpark,
} from "@/lib/sulwe";
import {
  TOUR_RUN_KEY,
  finishHref,
  neighborStep,
  parseTourRecord,
  parseTourRun,
  pathsMatch,
  persistTourRecord,
  placeTourBubble,
  readTourRecord,
  replayTour,
  resumedStepId,
  serializeTourRecord,
  serializeTourRun,
  skipTour,
  stepById,
  stepPath,
  stepsForRun,
  storageKeyForKind,
  tourBody,
  tourKindForPath,
  tourQueryOn,
  type TourBox,
  type TourPlacement,
  type TourRun,
} from "@/lib/tour";
import { TOUR_ACCEPT_KEY, TOUR_PROMPT_EVENT, tourEntry } from "@/lib/tour";

const EMPTY_PLACEMENT: TourPlacement & { target: string; sulwe: { top: number; left: number } | null } = {
  spot: null,
  side: "center",
  arrow: null,
  bubble: { top: 24, left: 12, width: 300, height: 220 },
  target: "",
  sulwe: null,
};

export function TourCard({
  lang,
  title,
  body,
  step,
  total,
  last,
  showBack,
  onNext,
  onBack,
  onSkip,
}: {
  lang: Lang;
  title: string;
  body: string;
  step: number;
  total: number;
  last: boolean;
  showBack: boolean;
  onNext: () => void;
  onBack: () => void;
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
      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            data-tour-dot=""
            className={`h-2.5 w-2.5 rounded-full ${index === step ? "bg-navy" : "bg-line"}`}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {showBack ? (
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-base font-semibold text-navy">
            {uiText(lang, "tour2_back")}
          </button>
        ) : null}
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

function viewportSize(): { width: number; height: number } {
  const visual = window.visualViewport;
  return {
    width: visual?.width ?? window.innerWidth,
    height: visual?.height ?? window.innerHeight,
  };
}

function visibleTarget(target: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width >= 2 && rect.height >= 2) return node;
  }
  return null;
}

function waitForTarget(target: string, timeoutMs: number): Promise<HTMLElement | null> {
  const existing = visibleTarget(target);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(visibleTarget(target));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const node = visibleTarget(target);
      if (!node) return;
      window.clearTimeout(timer);
      observer.disconnect();
      resolve(node);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}

function scrollTarget(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const view = viewportSize();
  const seen = rect.top >= 8 && rect.left >= 0 && rect.bottom <= view.height - 8 && rect.right <= view.width;
  if (seen) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
}

function measure(target: string, bubbleHeight: number, guide: boolean) {
  const node = visibleTarget(target);
  const rect = node?.getBoundingClientRect();
  const box: TourBox | null = rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
  const viewport = viewportSize();
  const placed = placeTourBubble({ target: box, viewport, bubbleHeight });
  const sulwe = guide ? placeSulwe({ bubble: placed.bubble, target: placed.spot, viewport, size: SULWE_TOUR_SIZE }) : null;
  return { ...placed, target, sulwe };
}

function writeRun(run: TourRun) {
  sessionStorage.setItem(TOUR_RUN_KEY, serializeTourRun(run));
  window.dispatchEvent(new Event("rangach-tour-run"));
}

function clearRun() {
  sessionStorage.removeItem(TOUR_RUN_KEY);
  window.dispatchEvent(new Event("rangach-tour-run"));
}

export function GuidedTour({ enabled, lang, sulwe = false }: { enabled: boolean; lang: Lang; sulwe?: boolean }) {
  const path = usePathname() || "/";
  const search = useSearchParams();
  const router = useRouter();
  const force = tourQueryOn(search.toString());
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [listingPath, setListingPath] = useState<string | null>(null);
  const [placement, setPlacement] = useState(EMPTY_PLACEMENT);
  const guideQuery = sulweQueryOn(search.toString());
  const sulwePreview = useSyncExternalStore(
    (notify) => {
      const onChange = () => notify();
      window.addEventListener("rangach-sulwe-preview", onChange);
      return () => window.removeEventListener("rangach-sulwe-preview", onChange);
    },
    () => sessionStorage.getItem(SULWE_PREVIEW_KEY) === "1",
    () => false,
  );
  const guide = sulwe || guideQuery || sulwePreview;

  const runRaw = useSyncExternalStore(
    (notify) => {
      const onChange = () => notify();
      window.addEventListener("rangach-tour-run", onChange);
      return () => window.removeEventListener("rangach-tour-run", onChange);
    },
    () => sessionStorage.getItem(TOUR_RUN_KEY) ?? "",
    () => "",
  );
  const storedRun = parseTourRun(runRaw);
  const kind = storedRun?.kind ?? tourKindForPath(path);
  const key = storageKeyForKind(kind);
  const steps = stepsForRun(kind, listingPath);

  const seenRaw = useSyncExternalStore(
    (notify) => {
      function onChange() {
        notify();
      }
      function onReplay() {
        const storageKey = storageKeyForKind(tourKindForPath(window.location.pathname));
        document.cookie = persistTourRecord(window.localStorage, storageKey, replayTour());
        // A replay starts the tour straight away, without the invite.
        sessionStorage.setItem(TOUR_ACCEPT_KEY, "1");
        clearRun();
        setClosedFor(null);
        notify();
      }
      window.addEventListener("rangach-tour-change", onChange);
      window.addEventListener("rangach-tour-replay", onReplay);
      return () => {
        window.removeEventListener("rangach-tour-change", onChange);
        window.removeEventListener("rangach-tour-replay", onReplay);
      };
    },
    () => serializeTourRecord(readTourRecord(window.localStorage, document.cookie, key)),
    () => "seen",
  );
  const accepted = useSyncExternalStore(
    (notify) => {
      window.addEventListener(TOUR_PROMPT_EVENT, notify);
      return () => window.removeEventListener(TOUR_PROMPT_EVENT, notify);
    },
    () => sessionStorage.getItem(TOUR_ACCEPT_KEY) === "1",
    () => false,
  );
  const record = parseTourRecord(seenRaw);
  const sessionClosed = closedFor === key;
  // First-time visitors get the invite (TourPrompt) instead of an automatic start.
  const open =
    !sessionClosed &&
    tourEntry({ path, flag: enabled, force, seen: record.seen, activeRun: Boolean(storedRun), accepted, declined: false }) === "tour";
  const stepId = open ? resumedStepId(runRaw, kind, steps) : steps[0]?.id ?? "";
  const step = stepById(steps, stepId);
  const stepIndex = Math.max(0, steps.findIndex((item) => item.id === step.id));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/tour/listing")
      .then((response) => response.json())
      .then((data: { path?: string | null }) => {
        if (!cancelled) setListingPath(typeof data.path === "string" ? data.path : null);
      })
      .catch(() => {
        if (!cancelled) setListingPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;
    const current = parseTourRun(sessionStorage.getItem(TOUR_RUN_KEY));
    if (current && current.kind === kind) return;
    writeRun({ kind, stepId: step.id, startPath: path });
  }, [open, step, kind, path]);

  useEffect(() => {
    if (!open || !step) return;
    const dest = stepPath(step, listingPath);
    if (dest && !pathsMatch(path, dest)) router.push(dest);
  }, [open, step, listingPath, path, router]);

  useEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const openSheet = () => {
      if (!step.openFilters) return;
      const details = document.querySelector<HTMLDetailsElement>('[data-tour="filters"]')?.closest("details");
      if (details) details.open = true;
    };
    const place = () => {
      if (cancelled) return;
      openSheet();
      const dialog = document.querySelector<HTMLElement>("[data-tour-dialog]");
      const next = measure(step.target, dialog?.offsetHeight || 220, guide);
      setPlacement(next);
    };
    const scheduled = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };
    let frame = 0;
    openSheet();
    void waitForTarget(step.target, 2000).then((node) => {
      if (cancelled) return;
      if (node) scrollTarget(node);
      place();
      if (!node || typeof ResizeObserver === "undefined") return;
      observer = new ResizeObserver(scheduled);
      observer.observe(node);
      // Re-place when the bubble changes size too (late fonts, Dholuo text), so Sulwe keeps clear of it.
      const bubbleNode = document.querySelector<HTMLElement>("[data-tour-dialog]");
      if (bubbleNode) observer.observe(bubbleNode);
    });
    window.addEventListener("resize", scheduled);
    window.addEventListener("scroll", scheduled, true);
    window.addEventListener("orientationchange", scheduled);
    window.visualViewport?.addEventListener("resize", scheduled);
    window.visualViewport?.addEventListener("scroll", scheduled);
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduled);
      window.removeEventListener("scroll", scheduled, true);
      window.removeEventListener("orientationchange", scheduled);
      window.visualViewport?.removeEventListener("resize", scheduled);
      window.visualViewport?.removeEventListener("scroll", scheduled);
    };
  }, [open, step, path, guide]);

  useEffect(() => {
    if (guideQuery && sessionStorage.getItem(SULWE_PREVIEW_KEY) !== "1") {
      sessionStorage.setItem(SULWE_PREVIEW_KEY, "1");
      window.dispatchEvent(new Event("rangach-sulwe-preview"));
    }
    sessionStorage.setItem(SULWE_TOUR_KEY, open ? "1" : "0");
    window.dispatchEvent(new Event("rangach-sulwe-tour"));
  }, [open, guideQuery]);

  useEffect(() => {
    if (!open) return;
    const dialog = document.querySelector<HTMLElement>("[data-tour-dialog]");
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.querySelector<HTMLElement>("button:last-of-type")?.focus();
    return () => {
      previous?.focus();
    };
  }, [open, stepIndex]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const magicKey =
    open && step && guide && placement.target === step.target && placement.spot && placement.sulwe ? step.id : "";

  useEffect(() => {
    // "Voila": the bubble appears once the wand sparkles land. It then stays until Next, Back, or Skip.
    if (!magicKey) return;
    const node = dialogRef.current;
    if (!node || typeof node.animate !== "function") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = node.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(8px) scale(0.94)" },
            { opacity: 1, transform: "none" },
          ],
      { duration: reduce ? 200 : 320, delay: reduce ? 0 : SULWE_VOILA_MS, easing: "cubic-bezier(.2,.9,.3,1.15)", fill: "backwards" },
    );
    return () => animation.cancel();
  }, [magicKey]);

  if (!open || !step) return null;

  function endTour() {
    document.cookie = persistTourRecord(window.localStorage, key, skipTour());
    sessionStorage.removeItem(TOUR_ACCEPT_KEY);
    clearRun();
    setClosedFor(key);
    window.dispatchEvent(new Event("rangach-tour-change"));
    const href = finishHref(storedRun?.startPath || path, path);
    if (href) router.push(href);
  }

  function onDialogKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      endTour();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
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

  function move(direction: 1 | -1) {
    const next = neighborStep(steps, step.id, direction);
    if (next.done) {
      endTour();
      return;
    }
    writeRun({ kind, stepId: next.id, startPath: storedRun?.startPath || path });
  }

  const arrowId = "tour-arrow";
  const placed = placement.target === step.target;
  const wand = placed && placement.sulwe && placement.spot ? sulweWand(placement.sulwe, placement.spot, SULWE_TOUR_SIZE) : null;
  // With Sulwe the wand replaces the arrow. Without him the plain arrow stays.
  const guideArrow = placed && !placement.sulwe ? placement.arrow : null;
  const voila = wand ? " tour-voila" : "";

  return (
    <div className="print:hidden" data-tour-layer="">
      <div className="fixed inset-0 z-[80]" aria-hidden="true" />
      {placed && placement.spot ? (
        <>
          {wand ? <div key={`dim-${step.id}`} className="tour-dim-out pointer-events-none fixed inset-0 z-[81] bg-navy/60" aria-hidden="true" /> : null}
          <div
            key={`spot-${step.id}`}
            aria-hidden="true"
            className={`pointer-events-none fixed z-[81] rounded-2xl${voila}`}
            style={{
              top: placement.spot.top,
              left: placement.spot.left,
              width: placement.spot.width,
              height: placement.spot.height,
              boxShadow: "0 0 0 9999px rgb(11 22 40 / 0.62)",
            }}
          />
          <div
            key={`ring-${step.id}`}
            aria-hidden="true"
            className={`tour-ring pointer-events-none fixed z-[81] rounded-2xl border-2 border-gold${voila}`}
            style={{
              top: placement.spot.top,
              left: placement.spot.left,
              width: placement.spot.width,
              height: placement.spot.height,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[81] bg-navy/60" aria-hidden="true" />
      )}
      {placement.sulwe && placed ? (
        <div
          className="sulwe-guide pointer-events-none fixed z-[84]"
          data-sulwe-guide=""
          style={{ top: placement.sulwe.top, left: placement.sulwe.left, width: SULWE_TOUR_SIZE, height: SULWE_TOUR_SIZE }}
        >
          <SulweArt pose={wand ? "" : "wave"} />
        </div>
      ) : null}
      {wand ? (
        <div key={`wand-${step.id}`} className="pointer-events-none fixed inset-0 z-[85]" aria-hidden="true" data-sulwe-magic="">
          <div
            className="sulwe-wand absolute"
            data-sulwe-wand=""
            style={{ left: wand.hand.x, top: wand.hand.y, ["--wand-aim" as string]: `${wand.angle}deg` } as CSSProperties}
          >
            <SulweWandArt className="block h-[25px] w-[46px]" />
          </div>
          <div className="absolute" style={{ left: wand.tip.x, top: wand.tip.y }}>
            {wand.trail.map((spark, index) => (
              <Spark key={`t${index}`} spark={spark} kind="trail" />
            ))}
          </div>
          <div className="absolute" style={{ left: wand.target.x, top: wand.target.y }}>
            {wand.burst.map((spark, index) => (
              <Spark key={`b${index}`} spark={spark} kind="burst" />
            ))}
          </div>
        </div>
      ) : null}
      {guideArrow ? (
        <svg className="pointer-events-none fixed inset-0 z-[82] h-full w-full" aria-hidden="true">
          <defs>
            <marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#c8881a" />
            </marker>
          </defs>
          <line
            x1={guideArrow.x1}
            y1={guideArrow.y1}
            x2={guideArrow.x2}
            y2={guideArrow.y2}
            stroke="#c8881a"
            strokeWidth="2.5"
            markerEnd={`url(#${arrowId})`}
          />
        </svg>
      ) : null}
      <div
        ref={dialogRef}
        className="fixed z-[83]"
        style={{
          top: placement.bubble.top,
          left: placement.bubble.left,
          width: placement.bubble.width,
          opacity: guide && !placed ? 0 : undefined,
        }}
        data-tour-dialog=""
        onKeyDown={onDialogKey}
      >
        <TourCard
          lang={lang}
          title={uiText(lang, step.title)}
          body={tourBody(lang, step)}
          step={stepIndex}
          total={steps.length}
          last={stepIndex === steps.length - 1}
          showBack={stepIndex > 0}
          onSkip={endTour}
          onBack={() => move(-1)}
          onNext={() => move(1)}
        />
      </div>
    </div>
  );
}

function Spark({ spark, kind }: { spark: SulweSpark; kind: "trail" | "burst" }) {
  return (
    <span
      className={`sulwe-spark-fly sulwe-spark-${kind} absolute -ml-[9px] -mt-[9px] block h-[18px] w-[18px]`}
      data-sulwe-spark={kind}
      style={{ ["--sx" as string]: `${spark.x}px`, ["--sy" as string]: `${spark.y}px`, animationDelay: `${spark.delay}ms` } as CSSProperties}
    >
      <SulweSparkArt className="block h-full w-full" />
    </span>
  );
}
