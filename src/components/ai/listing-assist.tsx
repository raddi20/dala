"use client";

import { useEffect, useState } from "react";
import { btnSecondary, fieldClass } from "@/components/ui";

export type ListingAssistDraft = {
  title: string;
  description: string;
  category: string;
  type: string;
  priceLabel: string;
  warnings: string[];
};

type Status = { enabled: boolean; consented: boolean };

export function ListingAssist({ onApply }: { onApply: (draft: ListingAssistDraft) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<"en" | "luo">("en");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/listing-draft")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Status | null) => {
        if (!cancelled && body && typeof body.enabled === "boolean") setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: false, consented: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.enabled) return null;

  async function writeDraft() {
    setNote("");
    setPending(true);
    try {
      const photoUrl = document.querySelector<HTMLInputElement>('input[name="photoUrl"]')?.value?.trim() ?? "";
      const response = await fetch("/api/ai/listing-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          language,
          photoUrl,
          consent: status?.consented || consent,
        }),
      });
      const body = (await response.json().catch(() => null)) as (ListingAssistDraft & { error?: string }) | null;
      if (!response.ok || !body || body.error || !body.title) {
        setNote(body?.error || "Not available right now. You can still fill the form yourself.");
        return;
      }
      if (!status?.consented) setStatus({ enabled: true, consented: true });
      onApply({
        title: body.title,
        description: body.description,
        category: body.category,
        type: body.type,
        priceLabel: body.priceLabel,
        warnings: Array.isArray(body.warnings) ? body.warnings : [],
      });
      setNote("");
    } catch {
      setNote("Not available right now. You can still fill the form yourself.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sand bg-sand/40 p-4">
      <label className="block text-sm font-medium" htmlFor="ai-listing-text">
        Write it for me
      </label>
      <p className="mt-1 text-sm text-ink/70">
        A short description fills the form for you to check. Nothing is published until you press Publish.
      </p>
      <textarea
        id="ai-listing-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={200}
        className={fieldClass}
        placeholder="Used sofa, 25k, good condition"
      />
      <label className="mt-3 block text-sm">
        Language
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value === "luo" ? "luo" : "en")}
          className={fieldClass}
        >
          <option value="en">English</option>
          <option value="luo">Dholuo</option>
        </select>
      </label>
      {status.consented ? null : (
        <label className="mt-3 flex items-start gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1 size-4 rounded border-sand"
          />
          <span>Rangach may send this text and photo to an AI service to draft the listing. I will check it before publishing.</span>
        </label>
      )}
      <button
        type="button"
        onClick={writeDraft}
        disabled={pending || text.trim().length === 0 || (!status.consented && !consent)}
        className={`${btnSecondary} mt-3`}
      >
        {pending ? "Writing…" : "Write it for me"}
      </button>
      {note ? <p className="mt-2 text-sm text-ink/80">{note}</p> : null}
    </div>
  );
}
