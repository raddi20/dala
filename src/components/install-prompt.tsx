"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { GateMark } from "@/components/wordmark";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_INSTALLED_KEY,
  INSTALL_OPEN_EVENT,
  installHintText,
  isInstallHiddenPath,
  resolveInstallSurface,
  shouldOfferInstall,
  type InstallGuide,
  type InstallSurface,
  type IosShareTarget,
} from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    try {
      localStorage.setItem(INSTALL_INSTALLED_KEY, "1");
    } catch {
      // Private mode can block storage. Hiding the hint is enough.
    }
    notify();
  });
}

function readStorage() {
  try {
    const dismissedRaw = localStorage.getItem(INSTALL_DISMISS_KEY);
    const dismissedAt = dismissedRaw == null ? null : Number(dismissedRaw);
    return {
      dismissedAt: dismissedAt != null && Number.isFinite(dismissedAt) ? dismissedAt : null,
      installed: localStorage.getItem(INSTALL_INSTALLED_KEY) === "1",
    };
  } catch {
    return { dismissedAt: null, installed: false };
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota and private-mode errors.
  }
}

function standaloneDisplay() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
  return modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches) || nav.standalone === true;
}

/** iOS Share icon (square with upward arrow), matching the Safari / Chrome toolbar control. */
function IosShareIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M12 3v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function iosShareWhere(target: IosShareTarget | undefined): string {
  return target === "address-bar" ? "in the address bar" : "in Safari";
}

function GuideBody({
  mode,
  title,
  iosShareTarget,
}: {
  mode: InstallSurface;
  title: string;
  iosShareTarget?: IosShareTarget;
}) {
  if (mode === "ios") {
    return (
      <div className="grid gap-1.5 text-sm leading-snug text-ink">
        <p className="font-semibold text-navy">{title}</p>
        <ol className="grid gap-1 text-ink/85">
          <li className="flex items-center gap-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-paper text-navy">
              <IosShareIcon className="h-4 w-4" />
            </span>
            <span>
              Tap <span className="font-semibold">Share</span> {iosShareWhere(iosShareTarget)}
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-paper px-1 text-xs font-semibold text-navy">
              2
            </span>
            <span>
              Then tap <span className="font-semibold">Add to Home Screen</span>
            </span>
          </li>
        </ol>
      </div>
    );
  }

  if (mode === "ios-open-safari") {
    return (
      <div className="grid gap-1 text-sm leading-snug text-ink">
        <p className="font-semibold text-navy">{title}</p>
        <p className="text-ink/85">
          This browser cannot add apps on your iOS version. Open the site in Safari, then tap Share and Add to Home
          Screen.
        </p>
      </div>
    );
  }

  if (mode === "android") {
    return <p className="text-sm leading-snug text-ink">Add it to your home screen for one-tap access.</p>;
  }

  if (mode === "android-manual") {
    return (
      <div className="grid gap-1.5 text-sm leading-snug text-ink">
        <p className="font-semibold text-navy">{title}</p>
        <ol className="grid gap-1 text-ink/85">
          <li className="flex items-center gap-1.5">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-paper px-1 text-xs font-semibold text-navy">
              ⋮
            </span>
            <span>
              Tap the <span className="font-semibold">⋮</span> menu in your browser
            </span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-paper px-1 text-xs font-semibold text-navy">
              2
            </span>
            <span>
              Then tap <span className="font-semibold">Install app</span> or{" "}
              <span className="font-semibold">Add to Home screen</span>
            </span>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="grid gap-1 text-sm leading-snug text-ink">
      <p className="font-semibold text-navy">{title}</p>
      <p className="text-ink/85">
        This in-app browser cannot install apps. Open the site in Chrome or Safari, then add it to your home screen.
      </p>
    </div>
  );
}

export function InstallPrompt({ appName }: { appName: string }) {
  const pathname = usePathname() || "/";
  const [guide, setGuide] = useState<InstallGuide | null>(null);
  const [forced, setForced] = useState(false);
  const [copied, setCopied] = useState(false);
  const forceRef = useRef(false);

  useEffect(() => {
    const hidden = isInstallHiddenPath(pathname);
    const standalone = standaloneDisplay();
    if (standalone) writeStorage(INSTALL_INSTALLED_KEY, "1");

    const sync = () => {
      const force = forceRef.current;
      const latest = readStorage();
      const offer = shouldOfferInstall({
        dismissedAt: latest.dismissedAt,
        now: Date.now(),
        installed: latest.installed || standalone,
        standalone,
        hiddenPath: hidden,
        force,
      });
      if (!offer) {
        setGuide(null);
        setForced(false);
        return;
      }
      const next = resolveInstallSurface({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        hasDeferredPrompt: Boolean(deferredPrompt),
      });
      setGuide(next);
      setForced(force);
    };

    const onOpen = () => {
      forceRef.current = true;
      sync();
    };

    listeners.add(sync);
    window.addEventListener(INSTALL_OPEN_EVENT, onOpen);
    sync();
    return () => {
      listeners.delete(sync);
      window.removeEventListener(INSTALL_OPEN_EVENT, onOpen);
    };
  }, [pathname]);

  if (!guide) return null;

  const mode = guide.surface;
  const title = installHintText(appName, mode);

  function dismiss() {
    writeStorage(INSTALL_DISMISS_KEY, String(Date.now()));
    forceRef.current = false;
    setForced(false);
    setGuide(null);
  }

  async function install() {
    const prompt = deferredPrompt;
    if (!prompt) {
      setGuide(null);
      return;
    }
    deferredPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        writeStorage(INSTALL_INSTALLED_KEY, "1");
      } else {
        writeStorage(INSTALL_DISMISS_KEY, String(Date.now()));
      }
    } catch {
      writeStorage(INSTALL_DISMISS_KEY, String(Date.now()));
    }
    forceRef.current = false;
    setForced(false);
    setGuide(null);
  }

  async function copyLink() {
    const url = window.location.origin + "/";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link and open it in Chrome or Safari:", url);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-3">
      <div
        id="install-hint"
        data-install-mode={mode}
        data-install-forced={forced ? "1" : "0"}
        role="region"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
        }}
        className="flex items-start gap-2.5 rounded-2xl border border-sand bg-card px-3 py-2.5 shadow-[var(--shadow-card)]"
      >
        <GateMark className="mt-0.5 h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <GuideBody mode={mode} title={title} iosShareTarget={guide.iosShareTarget} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {mode === "android" ? (
            <button
              type="button"
              className="btn-press rounded-full bg-navy px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-soft"
              onClick={() => {
                void install();
              }}
            >
              {title}
            </button>
          ) : null}
          {mode === "inapp" || mode === "ios-open-safari" ? (
            <button
              type="button"
              className="btn-press rounded-full bg-navy px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-soft"
              onClick={() => {
                void copyLink();
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-lg leading-none text-ink/55 hover:bg-paper hover:text-navy"
            aria-label={`Dismiss install hint for ${appName}`}
            onClick={dismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Always-available footer / menu control. Reopens the install guide even after
 * a dismiss. Hidden when the site is already running as an installed app.
 */
function subscribeNoop() {
  return () => undefined;
}

function useIsStandaloneApp() {
  return useSyncExternalStore(subscribeNoop, standaloneDisplay, () => false);
}

export function InstallAppLink({
  appName,
  className = "hover:text-navy",
}: {
  appName: string;
  className?: string;
}) {
  const standalone = useIsStandaloneApp();
  if (standalone) return null;

  return (
    <button
      type="button"
      className={className}
      data-install-link="1"
      onClick={() => {
        window.dispatchEvent(new Event(INSTALL_OPEN_EVENT));
        window.setTimeout(() => {
          const hint = document.getElementById("install-hint");
          if (hint) {
            hint.scrollIntoView({ behavior: "smooth", block: "nearest" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 50);
      }}
    >
      Install {appName}
    </button>
  );
}
