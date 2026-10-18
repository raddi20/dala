"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { canonicalCity } from "@/lib/constants";
import { TownOptions } from "@/components/town-options";
import { btnPrimary, ErrorNote, FieldError, fieldClass } from "@/components/ui";
import { PHONE_HINT } from "@/lib/phone";
import { PhotoField } from "@/components/photo-field";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function ProfileForm({
  user,
}: {
  user: {
    name: string;
    kind: string;
    city: string;
    bio: string;
    phone: string;
    whatsapp: string;
    avatarUrl: string;
    email: string;
  };
}) {
  const [state, action] = useActionState(updateProfile, initial);
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.field ? "" : state.error}</ErrorNote>
      <p className="text-sm text-ink/70">Email {user.email} stays as the sign-in address.</p>
      <label className="block text-sm">
        Name
        <input name="name" defaultValue={user.name} required className={fieldClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Profile type
          <select name="kind" defaultValue={user.kind} className={fieldClass}>
            <option value="person">Person</option>
            <option value="business">Business</option>
          </select>
        </label>
        <label className="block text-sm">
          Town
          <select name="city" defaultValue={canonicalCity(user.city) || "Nairobi"} className={fieldClass}>
            <TownOptions />
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Bio
        <textarea name="bio" defaultValue={user.bio} rows={4} maxLength={500} className={fieldClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Phone
          <input
            name="phone"
            defaultValue={user.phone}
            maxLength={48}
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            aria-invalid={state.field === "phone" || undefined}
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-ink/55">{PHONE_HINT}</span>
          <FieldError>{state.field === "phone" ? state.error : ""}</FieldError>
        </label>
        <label id="profile-whatsapp" className="block text-sm">
          WhatsApp
          <input
            name="whatsapp"
            defaultValue={user.whatsapp}
            maxLength={48}
            inputMode="tel"
            placeholder="0712 345 678"
            aria-invalid={state.field === "whatsapp" || undefined}
            className={fieldClass}
          />
          <FieldError>{state.field === "whatsapp" ? state.error : ""}</FieldError>
        </label>
      </div>
      <PhotoField
        name="avatarUrl"
        label="Profile photo"
        purpose="avatar"
        defaultUrl={user.avatarUrl}
        hint="Shows on your shop as the round logo. You can crop and brighten it before it uploads."
      />
      <SubmitButton className={btnPrimary} pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}
