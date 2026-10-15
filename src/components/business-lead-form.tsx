"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBusinessLead } from "@/lib/actions/business";
import { HONEYPOT_FIELD, BUSINESS_LEAD_THANKS } from "@/lib/business-lead";
import { BUSINESS_TIERS, tierOptionLabel } from "@/lib/business-tiers";
import { PHONE_HINT } from "@/lib/phone";
import { SubmitButton } from "@/components/submit-button";
import { btnPrimary, ErrorNote, fieldClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function BusinessLeadForm({
  tier,
  refCode,
  agentCode,
}: {
  tier: string;
  refCode: string;
  agentCode: string;
}) {
  const [state, action] = useActionState(createBusinessLead, initial);
  if (state.ok) {
    return (
      <p className="rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark" role="status">
        {state.message || BUSINESS_LEAD_THANKS}
      </p>
    );
  }

  return (
    <form id="signup" action={action} className="grid gap-3">
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="refCode" value={refCode} />
      <input type="hidden" name="agentCode" value={agentCode} />
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Company website
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <label className={labelClass}>
        Business name
        <input
          name="businessName"
          required
          minLength={2}
          maxLength={80}
          autoComplete="organization"
          placeholder="Lake Tilapia"
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Your name
        <input name="contactName" required minLength={2} maxLength={80} autoComplete="name" placeholder="Akinyi" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Phone
        <input
          name="phone"
          required
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0712 345 678"
          aria-describedby="business-phone-hint"
          className={fieldClass}
        />
        <span id="business-phone-hint" className="mt-1 block text-sm text-ink/60">
          {PHONE_HINT}
        </span>
      </label>
      <label className={labelClass}>
        Town
        <input name="town" required minLength={2} maxLength={60} autoComplete="address-level2" placeholder="Kisumu" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Plan
        <select name="tier" className={fieldClass} defaultValue={tier}>
          {BUSINESS_TIERS.map((item) => (
            <option key={item.id} value={item.id}>
              {tierOptionLabel(item)}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Notes <span className="font-normal text-ink/50">(optional)</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={500}
          placeholder="Saturday tilapia, or catering for an ayie."
          className={fieldClass}
        />
      </label>
      <p className="text-sm text-ink/70">
        We&apos;ll use your name, phone, and shop details to contact you about this plan.{" "}
        <Link href="/privacy" className="font-semibold text-lake-dark hover:text-lake">
          Privacy
        </Link>
      </p>
      <SubmitButton className={btnPrimary} pendingLabel="Sending…">
        Send my details
      </SubmitButton>
    </form>
  );
}
