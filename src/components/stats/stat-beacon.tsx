"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { tapKindForHref, viewKindForPath } from "@/lib/stats/events";

const STORAGE_KEY = "rangach_visitor";

function visitorId(): string {
  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing && /^[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
  const created = crypto.randomUUID().replace(/-/g, "");
  sessionStorage.setItem(STORAGE_KEY, created);
  return created;
}

function send(kind: string, path: string) {
  try {
    const body = JSON.stringify({ kind, path, visitorId: visitorId() });
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/track", blob);
  } catch {
    // Tracking never blocks the page.
  }
}

export function StatBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const kind = viewKindForPath(pathname);
    if (kind) send(kind, pathname);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!link) return;
      const kind = tapKindForHref(link.getAttribute("href") ?? "");
      if (!kind) return;
      send(kind, window.location.pathname);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
