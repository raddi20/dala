"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SAVED_EVENT, pushRecent, type SavedItem } from "@/lib/saved";
import { readRecent, writeRecent } from "@/lib/saved-store";

/** Records this listing in Recently viewed. Renders nothing. */
export function TrackRecent({ item }: { item: Omit<SavedItem, "at"> }) {
  useEffect(() => {
    writeRecent(pushRecent(readRecent(), { ...item, at: 0 }));
  }, [item]);
  return null;
}

export function MiniCard({ item }: { item: SavedItem }) {
  return (
    <Link
      href={`/listings/${item.id}`}
      className="flex w-36 shrink-0 flex-col overflow-hidden rounded-[12px] border border-line/80 bg-card shadow-[var(--shadow-card)]"
    >
      {item.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photo} alt="" width={144} height={96} loading="lazy" decoding="async" className="h-24 w-full object-cover" />
      ) : (
        <span className="flex h-24 items-end bg-navy p-2 font-serif text-xl text-white">{item.title.charAt(0).toUpperCase() || "R"}</span>
      )}
      <span className="line-clamp-2 px-2 pt-1.5 text-[13px] font-semibold leading-snug text-ink">{item.title}</span>
      <span className="truncate px-2 pb-2 text-[12px] text-muted">{[item.price, item.place].filter(Boolean).join(" · ")}</span>
    </Link>
  );
}

/** Horizontal strip of the last viewed listings. Hidden until there is one. */
export function RecentlyViewedStrip({ title = "Recently viewed", skipId }: { title?: string; skipId?: string }) {
  const [items, setItems] = useState<SavedItem[]>([]);
  useEffect(() => {
    const load = () => setItems(readRecent().filter((item) => item.id !== skipId));
    load();
    window.addEventListener(SAVED_EVENT, load);
    return () => window.removeEventListener(SAVED_EVENT, load);
  }, [skipId]);
  if (items.length === 0) return null;
  return (
    <section data-recently-viewed className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl text-navy">{title}</h2>
        <Link href="/saved?tab=recent" className="shrink-0 text-sm font-semibold text-gold-d">
          See all
        </Link>
      </div>
      <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <MiniCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
