"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const moreButtonClass =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-white/80 hover:text-white";

function menuItems(menu: HTMLElement | null) {
  if (!menu) return [];
  return [...menu.querySelectorAll<HTMLElement>("[role='menuitem']")].filter((item) => {
    const style = getComputedStyle(item);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

/** Desktop “More” menu. A disclosure element stays open across clicks outside, Escape, and client navigations. */
export function HeaderMore({ children }: { children: ReactNode }) {
  const menuId = useId();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = `${pathname}?${search}`;
  const [open, setOpen] = useState(false);
  const [routeSeen, setRouteSeen] = useState(route);
  if (routeSeen !== route) {
    setRouteSeen(route);
    setOpen(false);
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusIntent = useRef<"first" | "last" | null>(null);

  useEffect(() => {
    if (!open) return;
    const list = menuItems(menuRef.current);
    if (focusIntent.current === "first") list[0]?.focus();
    if (focusIntent.current === "last") list[list.length - 1]?.focus();
    focusIntent.current = null;

    const header = buttonRef.current?.closest("header");
    if (header) header.style.zIndex = "60";

    const onPointer = (event: PointerEvent) => {
      const node = event.target;
      if (node instanceof Node && rootRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      if (header) header.style.zIndex = "";
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const intent = event.key === "ArrowUp" ? "last" : "first";
    if (open) {
      const list = menuItems(menuRef.current);
      (intent === "last" ? list[list.length - 1] : list[0])?.focus();
      return;
    }
    focusIntent.current = intent;
    setOpen(true);
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const list = menuItems(menuRef.current);
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list[index < 0 ? 0 : (index + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[index <= 0 ? list.length - 1 : index - 1]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      list[list.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={moreButtonClass}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
      >
        More
      </button>
      <div
        id={menuId}
        ref={menuRef}
        role="menu"
        aria-label="More"
        hidden={!open}
        data-more-menu=""
        className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-white/15 bg-navy p-1 shadow-xl"
        onKeyDown={onMenuKeyDown}
        onClick={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("a, button")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
