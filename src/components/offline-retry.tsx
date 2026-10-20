"use client";

import { btnNavy } from "@/components/ui";
import { safeNext } from "@/lib/sw-policy";

/** Reloads the page the visitor wanted (?next=), or this page. */
export function OfflineRetry() {
  return (
    <button
      type="button"
      className={`${btnNavy} mt-6`}
      onClick={() => {
        const next = new URLSearchParams(window.location.search).get("next");
        if (next) window.location.href = safeNext(next);
        else window.location.reload();
      }}
    >
      Try again
    </button>
  );
}
