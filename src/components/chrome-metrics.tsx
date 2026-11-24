"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

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
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    apply();
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
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [path]);
  return null;
}
