"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinSendHome } from "@/lib/actions/send-home";
import { SEND_HOME_AREAS, SEND_HOME_COUNTRIES, SEND_HOME_THANKS } from "@/lib/send-home";
import { PHONE_HINT } from "@/lib/phone";
import { SubmitButton } from "@/components/submit-button";
import { btnPrimary, ErrorNote, fieldClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function SendHomeForm({
  baskets,
}: {
  baskets: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(joinSendHome, initial);
  if (state.ok) {
    return (
      <p className="rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark" role="status">
        {state.message || SEND_HOME_THANKS}
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-3">
      <ErrorNote>{state.error}</ErrorNote>
      <label className={labelClass}>
        Your name
        <input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Akinyi" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Email
        <input name="email" required type="email" autoComplete="email" placeholder="akinyi@example.com" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Country you are in
        <select name="country" className={fieldClass} defaultValue="gb">
          {SEND_HOME_COUNTRIES.map((country) => (
            <option key={country.id} value={country.id}>
              {country.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        If you chose Other, write the country
        <input name="countryOther" maxLength={60} className={fieldClass} />
      </label>
      <label className={labelClass}>
        Home area
        <select name="homeArea" className={fieldClass} defaultValue="kisumu">
          {SEND_HOME_AREAS.map((area) => (
            <option key={area.id} value={area.id}>
              {area.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        If you chose Other, write the town
        <input name="homeAreaOther" maxLength={60} placeholder="A town near Kisumu" className={fieldClass} />
      </label>
      <fieldset className="grid gap-2">
        <legend className={labelClass}>Baskets you want to hear about</legend>
        {baskets.map((basket) => (
          <label key={basket.id} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="baskets" value={basket.id} className="h-4 w-4 accent-navy" />
            {basket.label}
          </label>
        ))}
      </fieldset>
      <label className={labelClass}>
        WhatsApp <span className="font-normal text-ink/50">(optional)</span>
        <input name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" placeholder="0712 345 678" className={fieldClass} />
        <span className="mt-1 block text-sm text-ink/60">{PHONE_HINT}</span>
      </label>
      <label className="flex min-h-11 items-start gap-2 text-sm text-ink/80">
        <input type="checkbox" name="consent" value="1" className="mt-1 h-4 w-4 accent-navy" />
        <span>
          I agree to Rangach keeping these details so you can tell me when send-home baskets open.{" "}
          <Link href="/privacy" className="font-semibold text-lake-dark hover:text-lake">
            Privacy
          </Link>
        </span>
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Sending…">
        Join the waitlist
      </SubmitButton>
    </form>
  );
}
