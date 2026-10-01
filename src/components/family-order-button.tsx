"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FAMILY_PAYERS, familyOrderMessage, familyOrderWhatsappLink } from "@/lib/family-order";
import { btnSecondary, btnWhatsApp, fieldClass } from "@/components/ui";

export function FamilyOrderButton({
  phone,
  subjectName,
  path,
  siteName,
  variant = "inline",
}: {
  phone: string;
  subjectName: string;
  path: string;
  siteName: string;
  variant?: "inline" | "bar";
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [town, setTown] = useState("");
  const [dateNeeded, setDateNeeded] = useState("");
  const [payer, setPayer] = useState("");

  const origin = open && typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const url = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const draft = useMemo(
    () => ({
      subjectName,
      url,
      siteName,
      recipientName,
      town,
      dateNeeded,
      payer,
    }),
    [subjectName, url, siteName, recipientName, town, dateNeeded, payer],
  );
  const message = familyOrderMessage(draft);
  const link = familyOrderWhatsappLink(phone, draft);

  return (
    <>
      <button
        type="button"
        className={variant === "bar" ? `${btnSecondary} w-full` : btnSecondary}
        onClick={() => setOpen(true)}
      >
        Buying for family back home?
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/45 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card px-4 py-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:px-5"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="font-serif text-2xl text-navy">
              Buying for family back home?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              Add who it is for, if you want. We open WhatsApp with this note for {subjectName}. Nothing is saved on
              Rangach, and there is no payment or booking here.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="block text-sm font-medium text-ink/80">
                Recipient&apos;s name <span className="font-normal text-ink/50">(optional)</span>
                <input
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Akinyi Odhiambo"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-ink/80">
                Town or area <span className="font-normal text-ink/50">(optional)</span>
                <input
                  value={town}
                  onChange={(event) => setTown(event.target.value)}
                  maxLength={80}
                  placeholder="Kisumu, Milimani"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-ink/80">
                Date needed <span className="font-normal text-ink/50">(optional)</span>
                <input
                  value={dateNeeded}
                  onChange={(event) => setDateNeeded(event.target.value)}
                  maxLength={40}
                  placeholder="e.g. 20 December 2026"
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-ink/80">
                Who&apos;s paying <span className="font-normal text-ink/50">(optional)</span>
                <select value={payer} onChange={(event) => setPayer(event.target.value)} className={fieldClass}>
                  <option value="">Prefer not to say</option>
                  {FAMILY_PAYERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-2xl bg-paper px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">Message the seller will see</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{message}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink/45">WhatsApp link</p>
              <p className="mt-1 break-all text-xs leading-relaxed text-lake-dark">{link}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a href={link} target="_blank" rel="noreferrer" className={`${btnWhatsApp} w-full`}>
                Open WhatsApp
              </a>
              <button type="button" className={`${btnSecondary} w-full`} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
