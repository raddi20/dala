"use client";

import { useEffect, useState } from "react";
import { SAVED_EVENT, isSaved, toggleSaved, type SavedItem } from "@/lib/saved";
import { readSaved, syncHeart, writeSaved } from "@/lib/saved-store";

type Props = { item: Omit<SavedItem, "at">; variant?: "card" | "page" };

/** Heart on a listing card or page. Works without an account. */
export function SaveHeart({ item, variant = "card" }: Props) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSaved(isSaved(readSaved(), item.id));
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [item.id]);

  const toggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const next = toggleSaved(readSaved(), { ...item, at: 0 });
    writeSaved(next.list);
    setSaved(next.saved);
    syncHeart(item.id, next.saved);
  };

  const label = saved ? `Remove ${item.title} from Saved` : `Save ${item.title}`;
  const heart = (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.4-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 2.9 1.5-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.8-9.3 9.2-9.3 9.2z"
        fill={saved ? "#d64545" : "none"}
        stroke={saved ? "#d64545" : "currentColor"}
        strokeWidth="1.8"
      />
    </svg>
  );

  if (variant === "page") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={label}
        data-save-heart={item.id}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-line bg-card px-4 text-sm font-semibold text-navy"
      >
        {heart}
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      data-save-heart={item.id}
      className="absolute right-1.5 top-1.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full text-navy"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm">{heart}</span>
    </button>
  );
}
