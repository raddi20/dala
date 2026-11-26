"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { placeTourDock } from "@/lib/tour";

/**
 * One shared bottom offset for the nav, the WhatsApp bar, Sulwe, and the tour invite.
 * The bar height is measured when it appears or the window resizes, not on scroll.
 * On a phone, the iOS toolbar changes visualViewport while the finger is still moving.
 * Folding that gap into one variable keeps every fixed piece on the same screen edge.
 */
export function ChromeMetrics() {
  const path = usePathname();
  useLayoutEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const bars = [...document.querySelectorAll<HTMLElement>(".sticky-cta-bar")];
      const bar = bars.find((el) => {
        const style = getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && el.offsetHeight > 0;
      });
      const cta = bar ? bar.offsetHeight : 0;
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const vv = window.visualViewport;
      const gap = mobile && vv ? Math.round(window.innerHeight - vv.offsetTop - vv.height) : 0;
      const vvBottom = Number.isFinite(gap) && gap > 1 ? gap : 0;
      if (root.style.getPropertyValue("--rangach-cta") !== `${cta}px`) root.style.setProperty("--rangach-cta", `${cta}px`);
      if (root.style.getPropertyValue("--rangach-vv") !== `${vvBottom}px`) root.style.setProperty("--rangach-vv", `${vvBottom}px`);
      liftFloaters(root);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    const late = window.setTimeout(schedule, 500);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(late);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [path]);
  return null;
}

function shownBox(el: HTMLElement) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  if (style.display === "none" || style.visibility === "hidden" || rect.width < 2 || rect.height < 2) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function layoutBox(el: HTMLElement) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  if (style.display === "none" || rect.width < 2 || rect.height < 2) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** Move Sulwe and the docked tour pill together, or collapse the pill to a dot. */
function liftFloaters(root: HTMLElement) {
  const sulweEl = document.querySelector<HTMLElement>("[data-sulwe-root]");
  if (!sulweEl) {
    if (root.getAttribute("data-tour-invite")) root.removeAttribute("data-tour-invite");
    return;
  }
  const currentFloat = Number.parseFloat(root.style.getPropertyValue("--rangach-float-lift")) || 0;
  const sulweBox = layoutBox(sulweEl);
  if (!sulweBox) return;
  root.style.setProperty("--rangach-sulwe-size", `${Math.round(sulweBox.width)}px`);
  const prompt = document.querySelector<HTMLElement>("[data-tour-prompt='sulwe']");
  const pillBox = prompt ? layoutBox(prompt) : null;
  const obstacles = [...document.querySelectorAll<HTMLElement>("a, button")].flatMap((el) => {
    if (el.closest("[data-sulwe-root], [data-sulwe-ask], .sulwe-dock, [data-tour-prompt], [data-tour-invite-dot]")) return [];
    const box = shownBox(el);
    return box ? [box] : [];
  });
  const placed = placeTourDock({
    sulwe: { ...sulweBox, top: sulweBox.top + currentFloat },
    pill: pillBox ? { width: pillBox.width, height: pillBox.height } : { width: 0, height: 0 },
    obstacles,
    viewportHeight: window.innerHeight,
  });
  const nextLift = `${placed.lift}px`;
  if (root.style.getPropertyValue("--rangach-float-lift") !== nextLift) root.style.setProperty("--rangach-float-lift", nextLift);
  const invite = placed.collapsed && pillBox ? "dot" : "pill";
  if (root.getAttribute("data-tour-invite") !== invite) root.setAttribute("data-tour-invite", invite);
}
