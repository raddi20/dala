"use client";

import { useActionState } from "react";
import { createProtectedOrder } from "@/lib/actions/protected-order";
import { PHONE_HINT } from "@/lib/phone";
import { PROTECTED_ORDER_COPY } from "@/lib/protected-order";
import { SubmitButton } from "@/components/submit-button";
import { btnPrimary, ErrorNote, fieldClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function ProtectedOrderForm({
  slug,
  percent,
  offerings,
  deliveries,
}: {
  slug: string;
  percent: number;
  offerings: { id: string; title: string; price: string }[];
  deliveries: { id: string; label: string; price: string }[];
}) {
  const [state, action] = useActionState(createProtectedOrder, initial);
  return (
    <form action={action} className="grid gap-3">
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="grid gap-2">
        <legend className={labelClass}>Items</legend>
        {offerings.map((offering) => (
          <label key={offering.id} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-sm">
            <span>
              {offering.title}
              <span className="block text-ink/60">{offering.price}</span>
            </span>
            <input
              name={`qty_${offering.id}`}
              type="number"
              min={0}
              max={20}
              defaultValue={0}
              inputMode="numeric"
              aria-label={`Quantity for ${offering.title}`}
              className={fieldClass}
            />
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className={labelClass}>Delivery</legend>
        {deliveries.map((choice) => (
          <label key={choice.id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="delivery" value={choice.id} defaultChecked={choice.id === "pickup"} className="h-4 w-4 accent-navy" />
            {choice.label}
            <span className="text-ink/60">{choice.price}</span>
          </label>
        ))}
      </fieldset>
      <label className={labelClass}>
        Your name
        <input name="buyerName" required minLength={2} maxLength={80} autoComplete="name" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Email
        <input name="buyerEmail" required type="email" autoComplete="email" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Phone
        <input name="buyerPhone" required type="tel" autoComplete="tel" placeholder="0712 345 678" className={fieldClass} />
        <span className="mt-1 block text-sm text-ink/60">{PHONE_HINT}</span>
      </label>
      <p className="text-sm leading-relaxed text-ink/70">
        {PROTECTED_ORDER_COPY} The commission on this order is {percent}%. Payments are processed by Paystack. You will
        get a 6-digit collect code after Paystack confirms the payment.
      </p>
      <SubmitButton className={btnPrimary} pendingLabel="Opening Paystack…">
        Pay the shop
      </SubmitButton>
    </form>
  );
}
