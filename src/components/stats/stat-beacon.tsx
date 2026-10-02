"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { tapKindForHref, viewKindForPath } from "@/lib/stats/events";

const STORAGE_KEY = "rangach_visitor";

function rememberVisitor(id: string) {
  sessionStorage.setItem(STORAGE_KEY, id);
  document.cookie = `rangach_visitor=${id}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

function visitorId(): string {
  const fromCookie = document.cookie.match(/(?:^|; )rangach_visitor=([A-Za-z0-9_-]{16,80})/)?.[1];
  if (fromCookie) {
    rememberVisitor(fromCookie);
    return fromCookie;
  }
  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing && /^[A-Za-z0-9_-]{16,80}$/.test(existing)) {
    rememberVisitor(existing);
    return existing;
  }
  const created = crypto.randomUUID().replace(/-/g, "");
  rememberVisitor(created);
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
