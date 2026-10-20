"use client";

import { useEffect } from "react";
import { CONTACTED_KEY, parseContacted, recordContact } from "@/lib/shop-review";

/**
 * Remembers a tap on a WhatsApp or call link marked data-contact-shop, on this phone only.
 * On a later visit Sulwe may gently ask "How was it?". Nothing is sent to the server.
 */
export function ContactTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.<HTMLElement>("[data-contact-shop]");
      const slug = link?.dataset.contactShop;
      if (!slug) return;
      try {
        const list = parseContacted(localStorage.getItem(CONTACTED_KEY));
        localStorage.setItem(CONTACTED_KEY, JSON.stringify(recordContact(list, { slug, name: link.dataset.contactName ?? "" })));
      } catch {
        // No storage. No prompt later, nothing breaks.
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
