"use client";

import { btnSecondary } from "@/components/ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className={btnSecondary} onClick={() => window.print()}>
      {label}
    </button>
  );
}
