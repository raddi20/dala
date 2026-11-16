"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { RECRUITER_STORAGE_KEY, recruiterRefToRemember } from "@/lib/recruiter";

function remember(serverValue: string) {
  const params = new URLSearchParams(window.location.search);
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(RECRUITER_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const next = recruiterRefToRemember(params.get("ref"), stored, serverValue);
  if (next.write) {
    try {
      window.localStorage.setItem(RECRUITER_STORAGE_KEY, next.write);
    } catch {
      // Private mode can refuse storage. The cookie and the hidden field still carry the code.
    }
  }
  return next.value;
}

/** Writes a valid ref into localStorage. Renders nothing. */
export function RecruiterRefPersist({ serverValue }: { serverValue: string }) {
  useEffect(() => {
    remember(serverValue);
  }, [serverValue]);
  return null;
}

/** Hidden shop-sign-up field. The server value works with JavaScript off. localStorage fills a gap. */
export function RecruiterRefField({ serverValue }: { serverValue: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const value = remember(serverValue);
    if (ref.current) ref.current.value = value;
  }, [serverValue]);
  return <input ref={ref} type="hidden" name="recruiterCode" defaultValue={serverValue} />;
}
