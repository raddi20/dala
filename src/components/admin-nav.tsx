"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, activeAdminHref } from "@/lib/admin-sections";

const tab = "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap";

/** Admin tabs. One row that scrolls sideways on a phone. */
export function AdminNav({ ordersOn }: { ordersOn: boolean }) {
  const active = activeAdminHref(usePathname() ?? "");
  const items = [{ href: "/admin", label: "Dashboard" }, ...ADMIN_SECTIONS.filter((s) => ordersOn || s.href !== "/admin/orders")];
  return (
    <nav aria-label="Admin sections" className="border-b border-sand bg-card" data-admin-nav>
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
        {items.map((item) => {
          const on = item.href === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`${tab} ${on ? "bg-navy text-white" : "text-ink/75 hover:bg-paper"}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
