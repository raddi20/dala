"use client";

import { useSyncExternalStore } from "react";
import { LITE_COOKIE } from "@/lib/weak-data";

function readOn() {
  const match = new RegExp(`(?:^|; )${LITE_COOKIE}=([01])`).exec(document.cookie);
  if (match) return match[1] === "1";
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

/** Footer switch for smaller photos. Stored in a cookie for a year; the page reloads with the new sizes. */
export function DataSaverToggle() {
  const on = useSyncExternalStore(() => () => undefined, readOn, () => false);
  return (
    <button
      type="button"
      data-data-saver={on ? "on" : "off"}
      className="text-left hover:text-navy"
      onClick={() => {
        document.cookie = `${LITE_COOKIE}=${on ? "0" : "1"}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.location.reload();
      }}
    >
      Data saver: {on ? "On" : "Off"}
    </button>
  );
}
