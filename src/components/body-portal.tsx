"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Fixed chrome (bottom nav, Sulwe, the tour invite) must not sit inside a flex,
 * transformed, or filtered ancestor. iOS Safari then positions it against that
 * box instead of the screen, and it drifts as the page scrolls.
 * The server render stays in place so the HTML matches; in the browser it moves to body.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const client = useIsClient();
  if (!client) return children;
  return createPortal(children, document.body);
}
