"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MiniCard } from "@/components/recently-viewed";
import { SAVED_EVENT, mergeSaved, missingOnServer, type SavedItem } from "@/lib/saved";
import { readRecent, readSaved, writeRecent, writeSaved } from "@/lib/saved-store";

type Tab = "saved" | "recent";

export function SavedView({ initialTab, signedIn }: { initialTab: Tab; signedIn: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [recent, setRecent] = useState<SavedItem[]>([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const load = () => {
      setSaved(readSaved());
      setRecent(readRecent());
    };
    load();
    window.addEventListener(SAVED_EVENT, load);
    return () => window.removeEventListener(SAVED_EVENT, load);
  }, []);

  // Signed in: merge the account's hearts with this phone's, then send up the ones the account lacks.
  useEffect(() => {
    if (!signedIn) return;
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/saved", { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { items: SavedItem[]; ids: string[] };
        const local = readSaved();
        const missing = missingOnServer(local, data.ids);
        if (missing.length) {
          await fetch("/api/saved", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: missing }) });
        }
        if (!stop) {
          writeSaved(mergeSaved(local, data.items));
          setSynced(true);
        }
      } catch {
        // Offline. Local hearts still show.
      }
    })();
    return () => {
      stop = true;
    };
  }, [signedIn]);

  const list = tab === "saved" ? saved : recent;
  const tabClass = (on: boolean) =>
    `inline-flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold ${on ? "bg-navy text-white" : "text-navy"}`;

  return (
    <div className="grid gap-4">
      <div role="tablist" className="flex gap-1 rounded-full border border-line bg-card p-1">
        <button role="tab" aria-selected={tab === "saved"} className={tabClass(tab === "saved")} onClick={() => setTab("saved")}>
          Saved ({saved.length})
        </button>
        <button role="tab" aria-selected={tab === "recent"} className={tabClass(tab === "recent")} onClick={() => setTab("recent")}>
          Recently viewed
        </button>
      </div>
      <p className="text-sm text-muted">
        {signedIn
          ? synced
            ? "Synced to your account, so they follow you to another phone."
            : "Kept on this phone and in your account."
          : "Kept on this phone. No account needed. Sign in to keep them on any phone."}
      </p>
      {list.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-card p-5 text-sm text-ink/70">
          {tab === "saved"
            ? "Nothing saved yet. Tap the heart on a listing, like fresh tilapia in Nairobi or a fundi in Kisumu, and it waits here."
            : "Listings you open show up here."}
          <div className="mt-3">
            <Link href="/listings" className="font-semibold text-lake-dark">
              Explore listings
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 [&>a]:w-auto" data-saved-list={tab}>
          {list.map((item) => (
            <MiniCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {tab === "recent" && recent.length ? (
        <button type="button" className="justify-self-start text-sm font-semibold text-ink/60" onClick={() => writeRecent([])}>
          Clear recently viewed
        </button>
      ) : null}
    </div>
  );
}
