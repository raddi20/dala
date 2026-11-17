"use client";

import { useState } from "react";
import { btnSecondary } from "@/components/ui";

export function CopyTextButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={btnSecondary} onClick={() => void copy()}>
        {state === "copied" ? "Copied" : label}
      </button>
      {state === "failed" ? <span className="text-sm text-danger">Select the link and copy it.</span> : null}
    </span>
  );
}
