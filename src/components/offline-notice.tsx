"use client";

import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

/** A calm bar while the phone has no signal. Pages already opened still work from the offline copy. */
export function OfflineNotice() {
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  if (!offline) return null;
  return (
    <div
      role="status"
      data-offline-notice
      className="sticky top-14 z-20 border-b border-gold/40 bg-amber-soft px-4 py-2 text-center text-sm text-ink/85 print:hidden"
    >
      You&apos;re offline. Pages you&apos;ve already opened still work, and prices may have changed. We&apos;ll catch up when
      the signal is back.
    </div>
  );
}
