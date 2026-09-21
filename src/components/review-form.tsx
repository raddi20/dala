"use client";

import { useActionState } from "react";
import { createReview } from "@/lib/actions/social";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function ReviewForm({ listingId }: { listingId: string }) {
  const [state, action] = useActionState(createReview, initial);
  return (
    <form action={action} className="grid gap-3">
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="listingId" value={listingId} />
      <fieldset>
        <legend className="text-sm font-medium">Rating</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <label key={score} className="flex items-center gap-1 rounded-lg border border-sand bg-white px-3 py-2 text-sm">
              <input type="radio" name="rating" value={score} required />
              {score}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        Review
        <textarea name="body" required minLength={2} maxLength={1000} rows={3} className={fieldClass} />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Posting…">
        Post review
      </SubmitButton>
    </form>
  );
}
