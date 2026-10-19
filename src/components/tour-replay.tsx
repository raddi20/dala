"use client";

import type { Lang } from "@/lib/i18n/lang";
import { uiText } from "@/lib/i18n/strings";

/** Starts the tour again on this device. Rendered only while the tour flag is on. */
export function TourReplay({ lang }: { lang: Lang }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center font-medium text-ink/80 hover:text-navy"
      onClick={() => window.dispatchEvent(new Event("rangach-tour-replay"))}
    >
      {uiText(lang, "tour_replay")}
    </button>
  );
}
