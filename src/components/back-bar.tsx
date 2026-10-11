"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IN_APP_NAV_KEY,
  backBarTitle,
  backFallback,
  cameFromApp,
  pageTitleFromDocument,
  showsBackBar,
} from "@/lib/back-nav";

function readNavCount(): number {
  try {
    const count = Number(sessionStorage.getItem(IN_APP_NAV_KEY) || "0");
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

function rememberNav(count: number) {
  try {
    sessionStorage.setItem(IN_APP_NAV_KEY, String(count));
  } catch {
    // Private mode can refuse storage. The referrer check still works.
  }
}

export function BackBar({ brand }: { brand: string }) {
  const pathname = usePathname() || "/";
  const search = useSearchParams().toString();
  const router = useRouter();
  const [hash, setHash] = useState("");
  const titleRef = useRef<HTMLParagraphElement>(null);
  const placeRef = useRef<{ path: string; search: string; hash: string } | null>(null);
  const skipHashSync = useRef(true);

  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [pathname]);

  useEffect(() => {
    const prev = placeRef.current;
    placeRef.current = { path: pathname, search, hash };
    if (!prev) {
      if (readNavCount() === 0) rememberNav(0);
      return;
    }
    const hashSync = skipHashSync.current && prev.path === pathname && prev.search === search && prev.hash === "" && hash !== "";
    skipHashSync.current = false;
    if (hashSync) return;
    if (prev.path === pathname && prev.search === search && prev.hash === hash) return;
    rememberNav(readNavCount() + 1);
  }, [pathname, search, hash]);

  const place = { pathname, search, hash };
  const label = backBarTitle(place);

  useEffect(() => {
    const apply = () => {
      const node = titleRef.current;
      if (!node) return;
      node.textContent = pageTitleFromDocument(document.title, brand) || label;
    };
    apply();
    const titleNode = document.querySelector("title");
    if (!titleNode) return;
    const observer = new MutationObserver(apply);
    observer.observe(titleNode, { childList: true });
    return () => observer.disconnect();
  }, [brand, label]);

  if (!showsBackBar(pathname)) return null;

  const href = backFallback(place);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const inApp = cameFromApp({
      navCount: readNavCount(),
      referrer: document.referrer,
      historyLength: window.history.length,
      origin: window.location.origin,
    });
    if (!inApp) return;
    event.preventDefault();
    router.back();
  }

  return (
    <div className="back-bar border-b border-sand/80 bg-card print:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-2">
        <a
          href={href}
          aria-label="Go back"
          onClick={onClick}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-base font-semibold text-navy"
        >
          <span aria-hidden="true">←</span>
          Back
        </a>
        <p ref={titleRef} className="min-w-0 flex-1 truncate text-sm font-medium text-ink/70">
          {label}
        </p>
      </div>
    </div>
  );
}
