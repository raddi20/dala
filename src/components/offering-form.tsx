"use client";

import { useActionState, useState } from "react";
import { parsePrice } from "@/lib/price";
import { createOffering, updateOffering } from "@/lib/actions/storefront";
import { OFFERING_CURRENCIES } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { PhotoField } from "@/components/photo-field";
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
  const [price, setPrice] = useState(offering?.price ?? "");
  const [priceTouched, setPriceTouched] = useState(false);
  const priceCheck = parsePrice(price);
  const priceError = priceTouched && !priceCheck.ok ? priceCheck.error : "";

  return (
    <form action={formAction} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      {offering ? <input type="hidden" name="id" value={offering.id} /> : null}
      <label className="block text-sm">
        Title
        <input name="title" data-tour="sell-title" defaultValue={offering?.title ?? ""} required maxLength={80} className={fieldClass} />
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
            data-tour="sell-price"
            type="text"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => setPriceTouched(true)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={40}
            placeholder="100,000 or 80,000 – 120,000"
            aria-invalid={priceError ? true : undefined}
            aria-describedby="offering-price-help"
            className={fieldClass}
          />
          <span id="offering-price-help" className={priceError ? "mt-1 block text-xs text-red-700" : "mt-1 block text-xs text-ink/60"} role={priceError ? "alert" : undefined}>
            {priceError || "One price, or a range like 80k – 120k."}
          </span>
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
      <PhotoField
        name="imageUrl"
        label="Photo"
        dataTour="sell-photo"
        purpose="offering"
        resourceId={offering?.id}
        defaultUrl={offering?.imageUrl ?? ""}
        hint="Optional. Shows on your shop. You can crop and brighten it before it uploads."
      />
      <SubmitButton className={btnPrimary} pendingLabel="Saving…">
        {mode === "create" ? "Add offering" : "Save offering"}
      </SubmitButton>
    </form>
  );
}
