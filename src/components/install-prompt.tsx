"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GateMark } from "@/components/wordmark";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_INSTALLED_KEY,
  INSTALL_SESSION_KEY,
  INSTALL_VISITS_KEY,
  installHintText,
  isInstallHiddenPath,
  isIosSafari,
  nextVisitCount,
  shouldOfferInstall,
} from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallMode = "android" | "ios";

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
    const visits = Number(localStorage.getItem(INSTALL_VISITS_KEY) || "0");
    const dismissedRaw = localStorage.getItem(INSTALL_DISMISS_KEY);
    const dismissedAt = dismissedRaw == null ? null : Number(dismissedRaw);
    return {
      visits: Number.isFinite(visits) ? visits : 0,
      dismissedAt: dismissedAt != null && Number.isFinite(dismissedAt) ? dismissedAt : null,
      installed: localStorage.getItem(INSTALL_INSTALLED_KEY) === "1",
      counted: sessionStorage.getItem(INSTALL_SESSION_KEY) === "1",
    };
  } catch {
    return { visits: 0, dismissedAt: null, installed: false, counted: true };
  }
}

function writeStorage(key: string, value: string, persistent: boolean) {
  try {
    (persistent ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Ignore quota and private-mode errors.
  }
}

function standaloneDisplay() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
  return modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches) || nav.standalone === true;
}

export function InstallPrompt({ appName }: { appName: string }) {
  const pathname = usePathname() || "/";
  const [mode, setMode] = useState<InstallMode | null>(null);

  useEffect(() => {
    const hidden = isInstallHiddenPath(pathname);
    const stored = readStorage();
    const visits = nextVisitCount(stored.visits, stored.counted);
    if (!stored.counted) {
      writeStorage(INSTALL_VISITS_KEY, String(visits), true);
      writeStorage(INSTALL_SESSION_KEY, "1", false);
    }

    const standalone = standaloneDisplay();
    if (standalone) writeStorage(INSTALL_INSTALLED_KEY, "1", true);

    const sync = () => {
      const latest = readStorage();
      const offer = shouldOfferInstall({
        visits,
        dismissedAt: latest.dismissedAt,
        now: Date.now(),
        installed: latest.installed || standalone,
        standalone,
        hiddenPath: hidden,
      });
      if (!offer) {
        setMode(null);
        return;
      }
      // iPhone and iPad Safari never fire beforeinstallprompt. Prefer that hint when the
      // browser claims to be iOS Safari, including when desktop Chrome is emulating an iPhone.
      const ios = isIosSafari({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
      });
      if (ios) {
        setMode("ios");
        return;
      }
      setMode(deferredPrompt ? "android" : null);
    };

    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, [pathname]);

  if (!mode) return null;

  const label = installHintText(appName, "android");
  const body = mode === "ios" ? installHintText(appName, "ios") : "Add it to your home screen.";

  function dismiss() {
    writeStorage(INSTALL_DISMISS_KEY, String(Date.now()), true);
    setMode(null);
  }

  async function install() {
    const prompt = deferredPrompt;
    if (!prompt) return;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        writeStorage(INSTALL_INSTALLED_KEY, "1", true);
      } else {
        writeStorage(INSTALL_DISMISS_KEY, String(Date.now()), true);
      }
    } catch {
      writeStorage(INSTALL_DISMISS_KEY, String(Date.now()), true);
    }
    setMode(null);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-3">
      <div
        id="install-hint"
        role="region"
        aria-label={mode === "ios" ? body : label}
        onKeyDown={(event) => {
          if (event.key === "Escape") dismiss();
        }}
        className="flex items-start gap-2.5 rounded-2xl border border-sand bg-card px-3 py-2.5 shadow-[var(--shadow-card)]"
      >
        <GateMark className="mt-0.5 h-8 w-8 shrink-0" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-ink">{body}</p>
        <div className="flex shrink-0 items-center gap-1">
          {mode === "android" ? (
            <button
              type="button"
              className="btn-press rounded-full bg-navy px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-soft"
              onClick={() => {
                void install();
              }}
            >
              {label}
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
