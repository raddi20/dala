"use client";

import { useActionState } from "react";
import { saveAdminContact } from "@/lib/actions/admin-contact";
import type { ContactFormState, ContactKind } from "@/lib/admin-contact";
import { TownOptions } from "@/components/town-options";
import { canonicalCity } from "@/lib/constants";
import { PHONE_HINT } from "@/lib/phone";
import { btnPrimary, FieldError, fieldClass } from "@/components/ui";

export function AdminContactForm({
  kind,
  id,
  phone,
  whatsapp,
  city,
  phoneLabel,
  whatsappLabel,
}: {
  kind: ContactKind;
  id: string;
  phone: string;
  whatsapp: string;
  city: string;
  phoneLabel: string;
  whatsappLabel: string;
}) {
  const [state, action, pending] = useActionState(saveAdminContact, null as ContactFormState | null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm" htmlFor="admin-contact-phone">
        {phoneLabel}
        <input
          id="admin-contact-phone"
          name="phone"
          defaultValue={phone}
          maxLength={48}
          inputMode="tel"
          placeholder="0712 345 678"
          aria-invalid={state?.field === "phone" || undefined}
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-ink/55">{PHONE_HINT} Leave blank to clear.</span>
        <FieldError>{state?.field === "phone" ? state.error : ""}</FieldError>
      </label>
      <label className="block text-sm" htmlFor="admin-contact-whatsapp">
        {whatsappLabel}
        <input
          id="admin-contact-whatsapp"
          name="whatsapp"
          defaultValue={whatsapp}
          maxLength={48}
          inputMode="tel"
          placeholder="0712 345 678"
          aria-invalid={state?.field === "whatsapp" || undefined}
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-ink/55">Leave blank to clear.</span>
        <FieldError>{state?.field === "whatsapp" ? state.error : ""}</FieldError>
      </label>
      <label className="block text-sm" htmlFor="admin-contact-city">
        Town
        <select
          id="admin-contact-city"
          name="city"
          defaultValue={canonicalCity(city)}
          aria-invalid={state?.field === "city" || undefined}
          className={fieldClass}
        >
          <TownOptions blank="Leave town as it is" />
        </select>
        <FieldError>{state?.field === "city" ? state.error : ""}</FieldError>
      </label>
      <label className="block text-sm" htmlFor="admin-contact-reason">
        Reason
        <input
          id="admin-contact-reason"
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder="Why"
          aria-invalid={state?.field === "reason" || undefined}
          className={fieldClass}
        />
        <FieldError>{state?.field === "reason" ? state.error : ""}</FieldError>
      </label>
      <div>
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save numbers"}
        </button>
      </div>
    </form>
  );
}
