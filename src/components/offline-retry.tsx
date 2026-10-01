"use client";

import { btnNavy } from "@/components/ui";

export function OfflineRetry() {
  return (
    <button type="button" className={`${btnNavy} mt-6`} onClick={() => window.location.reload()}>
      Try again
    </button>
  );
}
