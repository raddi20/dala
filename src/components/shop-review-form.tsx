"use client";

import { useActionState, useEffect, useState } from "react";
import { createShopReview } from "@/lib/actions/shop-review";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CONTACTED_KEY, SHOP_REVIEW_MAX, markAsked, parseContacted } from "@/lib/shop-review";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function ShopReviewForm({
  storefrontId,
  slug,
  current,
}: {
  storefrontId: string;
  slug: string;
  current?: { rating: number; body: string } | null;
}) {
  const [state, action] = useActionState(createShopReview, initial);
  const [stars, setStars] = useState(current?.rating ?? 0);
  const [text, setText] = useState(current?.body ?? "");

  // Reviewed: Sulwe stops asking about this shop.
  useEffect(() => {
    if (!state.ok) return;
    try {
      const list = parseContacted(localStorage.getItem(CONTACTED_KEY));
      localStorage.setItem(CONTACTED_KEY, JSON.stringify(markAsked(list, slug)));
    } catch {
      // No storage.
    }
  }, [state.ok, slug]);

  if (state.ok) {
    return (
      <p role="status" data-shop-review-done className="rounded-[12px] bg-ok/10 px-3 py-2 text-sm text-ink/80">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-3" data-shop-review-form>
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="storefrontId" value={storefrontId} />
      <fieldset>
        <legend className="text-sm font-medium">Your rating</legend>
        <div className="mt-1 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((score) => (
            <label key={score} className="inline-flex h-11 w-11 cursor-pointer items-center justify-center text-3xl leading-none">
              <input
                type="radio"
                name="rating"
                value={score}
                required
                className="sr-only"
                checked={stars === score}
                onChange={() => setStars(score)}
                aria-label={`${score} star${score === 1 ? "" : "s"}`}
              />
              <span aria-hidden="true" className={score <= stars ? "text-gold" : "text-line"}>
                ★
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        A short comment
        <textarea
          name="body"
          required
          minLength={3}
          maxLength={SHOP_REVIEW_MAX}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Fresh tilapia, delivered on time."
          className={fieldClass}
        />
        <span className="mt-1 block text-right text-xs text-muted">
          {text.length}/{SHOP_REVIEW_MAX}
        </span>
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Posting…">
        {current ? "Update review" : "Post review"}
      </SubmitButton>
    </form>
  );
}
