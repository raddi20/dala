"use client";

import { useActionState, useState } from "react";
import { PhotoField } from "@/components/photo-field";
import { ErrorNote, fieldClass, btnPrimary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { postShopUpdate } from "@/lib/actions/community";
import { UPDATE_MAX, UPDATE_PAUSED } from "@/lib/community/text-guard";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function UpdateComposer({ paused, note }: { paused: boolean; note: string }) {
  const [state, action] = useActionState(postShopUpdate, initial);
  const [text, setText] = useState("");
  const over = text.trim().length > UPDATE_MAX;
  return (
    <form action={action} data-update-composer="" className="grid min-w-0 gap-3">
      <div>
        <h3 className="font-serif text-xl text-navy">Tell followers what is new</h3>
        <p className="mt-1 text-sm text-ink/70">
          A short note and one photo. It shows on your shop for 60 days. No payments and no phone numbers in the note.
        </p>
      </div>
      {paused ? (
        <p className="rounded-xl border border-gold/30 bg-amber-soft px-3.5 py-2.5 text-sm text-navy" role="status">
          {note.trim() || UPDATE_PAUSED}
        </p>
      ) : null}
      <div aria-live="polite">
        <ErrorNote>{state.error}</ErrorNote>
        {state.ok && state.message ? (
          <p className="rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark" role="status">
            {state.message}
          </p>
        ) : null}
      </div>
      <label className="block text-sm font-medium text-ink/80" htmlFor="shop-update-body">
        Update
        <textarea
          id="shop-update-body"
          name="body"
          rows={4}
          maxLength={UPDATE_MAX + 40}
          value={text}
          disabled={paused}
          onChange={(event) => setText(event.target.value)}
          placeholder="Omena is in this morning. Come by before noon."
          className={fieldClass}
        />
      </label>
      <p className={`text-xs font-semibold ${over ? "text-danger" : "text-muted"}`} aria-live="polite">
        {text.trim().length} / {UPDATE_MAX}
      </p>
      <PhotoField
        name="photoUrl"
        label="Photo, if you have one"
        purpose="update"
        hint="Optional. JPEG, PNG, or WebP. Crop it first. It uses the same photo storage as the rest of the shop."
      />
      <SubmitButton className={btnPrimary} pendingLabel="Posting…" disabled={paused || over || text.trim().length === 0}>
        Post update
      </SubmitButton>
    </form>
  );
}
