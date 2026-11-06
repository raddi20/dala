"use client";

import { useState } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary, btnWhatsApp, cardClass } from "@/components/ui";
import type { ChecklistItem } from "@/lib/seller-share/checklist";
import { checklistProgress } from "@/lib/seller-share/checklist";

export function SellerVisibilityChecklist({
  items,
  shopUrl,
  shopName,
  whatsappShareHref,
}: {
  items: ChecklistItem[];
  shopUrl: string;
  shopName: string;
  whatsappShareHref: string;
}) {
  const [copied, setCopied] = useState(false);
  const progress = checklistProgress(items);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shopUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`${cardClass} grid gap-4 p-5`} data-testid="seller-visibility-checklist">
      <div>
        <h2 className="font-serif text-xl text-navy">Visibility checklist</h2>
        <p className="mt-1 text-sm text-ink/70">
          Free with every live shop. {progress.done} of {progress.total} ready. Featured and Verified Pro are separate
          add-ons — this kit stays included.
        </p>
      </div>

      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-xl border border-line/70 bg-paper/50 px-3 py-2.5">
            <span
              className={
                item.done
                  ? "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lake text-xs font-bold text-white"
                  : "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-xs text-ink/40"
              }
              aria-hidden
            >
              {item.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy">{item.label}</p>
              <p className="text-sm text-ink/70">{item.hint}</p>
              {item.href && !item.done ? (
                <Link href={item.href} className="mt-1 inline-block text-sm font-semibold text-lake-dark underline">
                  Fix this
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button type="button" className={btnPrimary} onClick={copyLink} data-testid="copy-shop-link">
          {copied ? "Link copied" : "Copy shop link"}
        </button>
        {whatsappShareHref ? (
          <a href={whatsappShareHref} className={btnWhatsApp} target="_blank" rel="noreferrer" data-testid="whatsapp-share-shop">
            Share on WhatsApp
          </a>
        ) : null}
        <Link href="/account/share" className={btnSecondary}>
          Open Share &amp; promote
        </Link>
      </div>
      <p className="break-all text-xs text-ink/55">
        {shopName}: {shopUrl}
      </p>
    </section>
  );
}
