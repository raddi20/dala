"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BodyPortal } from "@/components/body-portal";
import type { Lang } from "@/lib/i18n/lang";
import { uiText } from "@/lib/i18n/strings";
import { SULWE_PREVIEW_KEY, shouldShowSulwe, sulweHiddenPath, sulweQueryOn } from "@/lib/sulwe";
import {
  TOUR_ACCEPT_KEY,
  TOUR_PROMPT_EVENT,
  TOUR_RUN_KEY,
  parseTourRun,
  readTourDeclined,
  readTourRecord,
  storageKeyForKind,
  tourEntry,
  tourKindForPath,
  tourPromptLift,
  tourQueryOn,
  writeTourDeclined,
} from "@/lib/tour";

function useStore(events: string[], read: () => boolean, server: boolean) {
  return useSyncExternalStore(
    (notify) => {
      for (const name of events) window.addEventListener(name, notify);
      return () => {
        for (const name of events) window.removeEventListener(name, notify);
      };
    },
    read,
    () => server,
  );
}

/** One short line beside Sulwe. The signed-off sentence stays on the dialog for screen readers. */
function compactInvite(lang: Lang) {
  if (lang === "dholuo") return { line: "Tour machiek?", yes: "Ee" };
  return { line: "Quick tour?", yes: "Yes" };
}

/** The invite itself. A single 44px line beside Sulwe, not a card over the page. */
export function TourPromptCard({
  lang,
  withSulwe,
  onYes,
  onNo,
  titleId = "tour-prompt-title",
}: {
  lang: Lang;
  withSulwe: boolean;
  onYes: () => void;
  onNo: () => void;
  titleId?: string;
}) {
  const short = compactInvite(lang);
  const promptRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const node = promptRef.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const current = Number.parseFloat(getComputedStyle(node).getPropertyValue("--rangach-tour-lift")) || 0;
      const obstacles = [...document.querySelectorAll<HTMLElement>("[data-primary-action], [data-save-heart], [data-follow-shop]")].flatMap((el) => {
        if (node.contains(el)) return [];
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || box.width < 2 || box.height < 2) return [];
        return [{ top: box.top, left: box.left, width: box.width, height: box.height }];
      });
      const next = tourPromptLift({
        prompt: { top: rect.top + current, left: rect.left, width: rect.width, height: rect.height },
        obstacles,
      });
      setLift((prev) => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    const late = window.setTimeout(measure, 350);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(late);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [lang, withSulwe]);
  return (
    <BodyPortal>
    <div
      ref={promptRef}
      role="dialog"
      aria-modal="false"
      aria-label={uiText(lang, withSulwe ? "invite_tour_hi" : "invite_tour_card")}
      data-tour-prompt={withSulwe ? "sulwe" : "card"}
      className="tour-prompt fixed z-[46] flex h-11 items-center gap-1 rounded-full border-2 border-gold bg-white pl-3 pr-1 shadow-[0_6px_16px_rgb(20_26_36/0.16)] print:hidden"
      style={{ ["--rangach-tour-lift" as string]: `${lift}px` }}
    >
      {withSulwe ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-[7px] right-7 h-2.5 w-2.5 rotate-45 border-b-2 border-r-2 border-gold bg-white"
          data-tour-prompt-tail=""
        />
      ) : null}
      <p id={titleId} className="whitespace-nowrap text-sm font-semibold leading-none text-navy">
        {short.line}
      </p>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded-full bg-gold px-2.5 text-sm font-semibold leading-none text-navy"
        data-tour-prompt-yes=""
        aria-label={uiText(lang, "invite_tour_yes")}
        onClick={onYes}
      >
        {short.yes}
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center text-lg leading-none text-navy/70"
        data-tour-prompt-no=""
        aria-label={uiText(lang, "invite_tour_no")}
        onClick={onNo}
      >
        ×
      </button>
    </div>
    </BodyPortal>
  );
}

/** Asks a first-time visitor before the tour starts. ?tour=1 and replays skip this. */
export function TourPrompt({ enabled, lang, sulwe = false }: { enabled: boolean; lang: Lang; sulwe?: boolean }) {
  const path = usePathname() || "/";
  const search = useSearchParams();
  const titleId = useId();
  const force = tourQueryOn(search.toString());
  const runRaw = useSyncExternalStore(
    (notify) => {
      window.addEventListener("rangach-tour-run", notify);
      return () => window.removeEventListener("rangach-tour-run", notify);
    },
    () => sessionStorage.getItem(TOUR_RUN_KEY) ?? "",
    () => "",
  );
  const run = parseTourRun(runRaw);
  const kind = run?.kind ?? tourKindForPath(path);
  const seen = useStore(
    ["rangach-tour-change", "rangach-tour-replay", TOUR_PROMPT_EVENT],
    () => readTourRecord(window.localStorage, document.cookie, storageKeyForKind(kind)).seen,
    true,
  );
  const accepted = useStore([TOUR_PROMPT_EVENT, "rangach-tour-replay"], () => sessionStorage.getItem(TOUR_ACCEPT_KEY) === "1", false);
  const declined = useStore([TOUR_PROMPT_EVENT], () => readTourDeclined(window.localStorage, kind), true);
  const preview = useStore(["rangach-sulwe-preview"], () => sessionStorage.getItem(SULWE_PREVIEW_KEY) === "1", false);

  const entry = tourEntry({ path, flag: enabled, force, seen, activeRun: Boolean(run), accepted, declined });
  // Not on sign-in, checkout, payment, or order pages.
  if (entry !== "prompt" || sulweHiddenPath(path)) return null;
  const withSulwe = shouldShowSulwe({ path, flag: sulwe, force: sulweQueryOn(search.toString()) || preview, keyboard: false });

  return (
    <TourPromptCard
      lang={lang}
      withSulwe={withSulwe}
      titleId={titleId}
      onYes={() => {
        sessionStorage.setItem(TOUR_ACCEPT_KEY, "1");
        window.dispatchEvent(new Event(TOUR_PROMPT_EVENT));
      }}
      onNo={() => {
        writeTourDeclined(window.localStorage, kind);
        window.dispatchEvent(new Event(TOUR_PROMPT_EVENT));
      }}
    />
  );
}
