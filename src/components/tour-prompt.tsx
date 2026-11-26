"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** The dock is already portaled to body, so the pill rides with Sulwe. */
function SulweDock({ children }: { children: ReactNode }) {
  const client = useIsClient();
  const [dock, setDock] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!client) return;
    const find = () => setDock(document.querySelector<HTMLElement>(".sulwe-dock"));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [client]);
  if (!client || !dock) return children;
  return createPortal(children, dock);
}

/** The invite itself. Beside Sulwe it shares his row; without him it is a short line. */
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
  const pill = (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={uiText(lang, withSulwe ? "invite_tour_hi" : "invite_tour_card")}
      data-tour-prompt={withSulwe ? "sulwe" : "card"}
      className={`tour-prompt z-[46] flex h-11 items-center gap-1 rounded-full border-2 border-gold bg-white pl-3 pr-1 shadow-[0_6px_16px_rgb(20_26_36/0.16)] print:hidden ${withSulwe ? "tour-prompt-docked" : "fixed"}`}
    >
      {withSulwe ? (
        <span
          aria-hidden="true"
          className="absolute -right-[7px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r-2 border-t-2 border-gold bg-white"
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
  );
  if (withSulwe) {
    return (
      <SulweDock>
        {pill}
        <button type="button" className="tour-invite-dot" data-tour-invite-dot="" aria-label={uiText(lang, "invite_tour_yes")} onClick={onYes}>
          <span />
        </button>
      </SulweDock>
    );
  }
  return <BodyPortal>{pill}</BodyPortal>;
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
