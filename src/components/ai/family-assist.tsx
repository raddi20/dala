"use client";

import { useEffect, useState } from "react";
import { btnSecondary, fieldClass } from "@/components/ui";

export type FamilyAssistFields = {
  item: string;
  recipientName: string;
  town: string;
  dateNeeded: string;
  payer: string;
  notes: string;
};

export function FamilyAssist({
  subjectName,
  onAvailable,
  onApply,
}: {
  subjectName: string;
  onAvailable: () => void;
  onApply: (fields: FamilyAssistFields) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/family-helper")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { enabled?: boolean } | null) => {
        if (cancelled || !body?.enabled) return;
        setEnabled(true);
        onAvailable();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // The callback only reveals extra fields. Re-running this fetch on each render is not useful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return null;

  async function fill() {
    setNote("");
    setPending(true);
    try {
      const response = await fetch("/api/ai/family-helper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, subjectName }),
      });
      const body = (await response.json().catch(() => null)) as (FamilyAssistFields & { error?: string }) | null;
      if (!response.ok || !body || body.error) {
        setNote(body?.error || "Not available right now. You can still fill the form yourself.");
        return;
      }
      onApply({
        item: body.item ?? "",
        recipientName: body.recipientName ?? "",
        town: body.town ?? "",
        dateNeeded: body.dateNeeded ?? "",
        payer: body.payer ?? "",
        notes: body.notes ?? "",
      });
    } catch {
      setNote("Not available right now. You can still fill the form yourself.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="block text-sm font-medium text-ink/80" htmlFor="family-assist-text">
        Describe it in a sentence <span className="font-normal text-ink/50">(optional)</span>
      </label>
      <textarea
        id="family-assist-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={400}
        placeholder="Chairs for my mother in Siaya next Saturday"
        className={fieldClass}
      />
      <button type="button" className={btnSecondary} onClick={fill} disabled={pending || text.trim().length === 0}>
        {pending ? "Filling…" : "Fill the form"}
      </button>
      <p className="text-xs text-ink/55">This only fills the form. You still press Open WhatsApp. Nothing is booked.</p>
      {note ? <p className="text-sm text-ink/80">{note}</p> : null}
    </div>
  );
}
