"use client";

import { useEffect, useState } from "react";
import { nearParam } from "@/lib/near-me";

type State = "idle" | "asking" | "denied" | "unavailable";
const NOTE_EVENT = "rangach:near-me";

/**
 * Opt-in. Location is asked only after a tap, rounded to about 1 km, and put in the URL as ?near=.
 * When permission is denied or the phone cannot tell, shops keep the usual order and a short note shows.
 */
export function NearMeButton({ active, onHref, offHref, className, activeClassName }: {
  active: boolean;
  /** URL with every other filter kept and ?near= to be filled. */
  onHref: string;
  offHref: string;
  className: string;
  activeClassName: string;
}) {
  const [state, setRaw] = useState<State>("idle");
  const setState = (next: State) => {
    setRaw(next);
    window.dispatchEvent(new CustomEvent(NOTE_EVENT, { detail: next }));
  };

  const ask = () => {
    if (active) {
      window.location.href = offHref;
      return;
    }
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState("idle");
        const url = new URL(onHref, window.location.origin);
        url.searchParams.set("near", nearParam({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
        url.searchParams.delete("page");
        window.location.href = url.toString();
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return (
    <button type="button" onClick={ask} aria-pressed={active} data-near-me className={active ? activeClassName : className}>
        <span aria-hidden="true">📍</span> {state === "asking" ? "Finding you…" : "Near me"}
    </button>
  );
}

/** The friendly fallback line, shown under the search bar (the pill row scrolls sideways). */
export function NearMeNote() {
  const [state, setState] = useState<State>("idle");
  useEffect(() => {
    const on = (event: Event) => setState((event as CustomEvent<State>).detail);
    window.addEventListener(NOTE_EVENT, on);
    return () => window.removeEventListener(NOTE_EVENT, on);
  }, []);
  return (
    <>
      {state === "denied" || state === "unavailable" ? (
        <p role="status" data-near-me-note className="rounded-[12px] bg-amber-soft px-3 py-2 text-sm text-ink/80">
          {state === "denied"
            ? "Location is off, so shops stay in the usual order. You can pick a town in Filters, or allow location for this site and tap Near me again."
            : "We couldn't tell where you are just now. Shops stay in the usual order. Pick a town in Filters instead."}
        </p>
      ) : null}
    </>
  );
}
