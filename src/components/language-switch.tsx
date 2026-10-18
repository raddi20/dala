"use client";

import { useRouter } from "next/navigation";
import { persistLangCookie, type Lang } from "@/lib/i18n/lang";
import { uiText } from "@/lib/i18n/strings";

export function LanguageSwitch({ lang, onPick }: { lang: Lang; onPick: (lang: Lang) => void }) {
  return (
    <div role="group" aria-label={uiText(lang, "lang_group")} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold">
      <button
        type="button"
        aria-pressed={lang === "en"}
        onClick={() => onPick("en")}
        className={lang === "en" ? "text-gold-l" : "text-white/70"}
      >
        {uiText(lang, "lang_en")}
      </button>
      <span aria-hidden="true" className="text-white/40">
        |
      </span>
      <button
        type="button"
        aria-pressed={lang === "dholuo"}
        onClick={() => onPick("dholuo")}
        className={lang === "dholuo" ? "text-gold-l" : "text-white/70"}
      >
        {uiText(lang, "lang_dholuo")}
      </button>
    </div>
  );
}

/** Hidden while the Dholuo flag is off, so the live site stays English. */
export function LanguageSwitchSlot({ enabled, lang }: { enabled: boolean; lang: Lang }) {
  if (!enabled) return null;
  return <LanguageSwitch lang={lang} onPick={() => undefined} />;
}

/** Writes the device cookie, then asks the server to render that language. */
export function LanguageSwitchControl({ lang }: { lang: Lang }) {
  const router = useRouter();
  return (
    <LanguageSwitch
      lang={lang}
      onPick={(next) => {
        document.cookie = persistLangCookie(next);
        router.refresh();
      }}
    />
  );
}
