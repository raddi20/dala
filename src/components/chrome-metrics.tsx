"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { tourPromptLift } from "@/lib/tour";

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

function unionBox(nodes: HTMLElement[]) {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of nodes) {
    const box = shownBox(el);
    if (!box) continue;
    top = Math.min(top, box.top);
    left = Math.min(left, box.left);
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  if (!Number.isFinite(top)) return null;
  return { top, left, width: right - left, height: bottom - top };
}

/** Keep Sulwe and the quick-tour pill off every visible link and button. */
function liftFloaters(root: HTMLElement) {
  const controls = [...document.querySelectorAll<HTMLElement>("a, button")].flatMap((el) => {
    if (el.closest("[data-sulwe-root], [data-sulwe-ask], .sulwe-dock, [data-tour-prompt]")) return [];
    const box = shownBox(el);
    return box ? [box] : [];
  });
  const reading = [...document.querySelectorAll<HTMLElement>("[data-shop-tabs], [data-shop-updates], h1")].flatMap((el) => {
    const box = shownBox(el);
    return box ? [box] : [];
  });
  const currentFloat = Number.parseFloat(root.style.getPropertyValue("--rangach-float-lift")) || 0;
  const sulwe = unionBox([...document.querySelectorAll<HTMLElement>("[data-sulwe-root], [data-sulwe-ask], .sulwe-dock")]);
  const sulweLift = sulwe ? tourPromptLift({ prompt: { ...sulwe, top: sulwe.top + currentFloat }, obstacles: controls }) : 0;
  if (root.style.getPropertyValue("--rangach-float-lift") !== `${sulweLift}px`) {
    root.style.setProperty("--rangach-float-lift", `${sulweLift}px`);
  }
  const prompt = document.querySelector<HTMLElement>("[data-tour-prompt]");
  if (!prompt) return;
  const box = shownBox(prompt);
  const current = Number.parseFloat(getComputedStyle(prompt).getPropertyValue("--rangach-tour-lift")) || 0;
  const tourLift = box ? tourPromptLift({ prompt: { ...box, top: box.top + current }, obstacles: [...controls, ...reading] }) : 0;
  if (prompt.style.getPropertyValue("--rangach-tour-lift") !== `${tourLift}px`) {
    prompt.style.setProperty("--rangach-tour-lift", `${tourLift}px`);
  }
}
