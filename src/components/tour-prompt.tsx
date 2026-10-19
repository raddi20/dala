"use client";

import { useId, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { btnPrimary, btnSecondary } from "@/components/ui";
import type { Lang } from "@/lib/i18n/lang";
import { uiText } from "@/lib/i18n/strings";
import { SULWE_PREVIEW_KEY, SULWE_SIZE, shouldShowSulwe, sulweHiddenPath, sulweQueryOn } from "@/lib/sulwe";
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

/** The invite itself. Sulwe asks in a speech bubble; without him it is a small card. Never blocks the page. */
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
  const style = withSulwe
    ? { right: 12 + SULWE_SIZE + 10, width: `min(260px, calc(100vw - ${SULWE_SIZE + 44}px))` }
    : { right: 12, left: 12, maxWidth: 360, marginLeft: "auto" };
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-tour-prompt={withSulwe ? "sulwe" : "card"}
      className="tour-prompt fixed z-[46] rounded-2xl border-2 border-gold bg-card p-3 shadow-[0_10px_30px_rgb(20_26_36/0.22)] print:hidden"
      style={{ ...style, bottom: "calc(4rem + env(safe-area-inset-bottom) + 12px)" }}
    >
      {withSulwe ? (
        <span
          aria-hidden="true"
          className="absolute -right-[9px] bottom-5 h-4 w-4 rotate-45 border-r-2 border-t-2 border-gold bg-card"
          data-tour-prompt-tail=""
        />
      ) : null}
      <p id={titleId} className="text-base font-semibold leading-snug text-navy">
        {uiText(lang, withSulwe ? "invite_tour_hi" : "invite_tour_card")}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" className={`${btnPrimary} flex-1 whitespace-nowrap`} data-tour-prompt-yes="" onClick={onYes}>
          {uiText(lang, "invite_tour_yes")}
        </button>
        <button type="button" className={`${btnSecondary} flex-1 whitespace-nowrap`} data-tour-prompt-no="" onClick={onNo}>
          {uiText(lang, "invite_tour_no")}
        </button>
      </div>
    </div>
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
