"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { CITIES } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
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
      <ErrorNote>{state.error}</ErrorNote>
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
          City
          <select name="city" defaultValue={user.city} className={fieldClass}>
            {CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
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
          <input name="phone" defaultValue={user.phone} className={fieldClass} />
        </label>
        <label id="profile-whatsapp" className="block text-sm">
          WhatsApp
          <input name="whatsapp" defaultValue={user.whatsapp} className={fieldClass} />
        </label>
      </div>
      <PhotoField
        name="avatarUrl"
        label="Profile photo"
        purpose="avatar"
        defaultUrl={user.avatarUrl}
        hint="Shows on your shop page. Drop a photo, or choose one from this phone or computer."
      />
      <SubmitButton className={btnPrimary} pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}
