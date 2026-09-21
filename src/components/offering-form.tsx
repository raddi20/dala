"use client";

import { useActionState } from "react";
import { createOffering, updateOffering } from "@/lib/actions/storefront";
import { OFFERING_CURRENCIES } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function OfferingForm({
  mode,
  currencyDefault,
  offering,
}: {
  mode: "create" | "edit";
  currencyDefault: string;
  offering?: {
    id: string;
    title: string;
    description: string;
    price: string;
    currency: string;
    imageUrl: string;
  };
}) {
  const action = mode === "create" ? createOffering : updateOffering;
  const [state, formAction] = useActionState(action, initial);

  return (
    <form action={formAction} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      {offering ? <input type="hidden" name="id" value={offering.id} /> : null}
      <label className="block text-sm">
        Title
        <input name="title" defaultValue={offering?.title ?? ""} required maxLength={80} className={fieldClass} />
      </label>
      <label className="block text-sm">
        Short description
        <textarea
          name="description"
          defaultValue={offering?.description ?? ""}
          rows={3}
          maxLength={400}
          className={fieldClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Price
          <input
            name="price"
            defaultValue={offering?.price ?? ""}
            inputMode="decimal"
            placeholder="450"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          Currency
          <select name="currency" defaultValue={offering?.currency || currencyDefault} className={fieldClass}>
            {OFFERING_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Photo URL
        <input name="imageUrl" defaultValue={offering?.imageUrl ?? ""} placeholder="https://" className={fieldClass} />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Saving…">
        {mode === "create" ? "Add offering" : "Save offering"}
      </SubmitButton>
    </form>
  );
}
