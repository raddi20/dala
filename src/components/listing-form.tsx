"use client";

import { useActionState, useState } from "react";
import { createListing, updateListing } from "@/lib/actions/listings";
import { CATEGORIES, CITIES, LISTING_TYPES } from "@/lib/constants";
import { draftListing } from "@/lib/draft";
import { btnPrimary, btnSecondary, ErrorNote, fieldClass } from "@/components/ui";
import { PhotoField } from "@/components/photo-field";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

type Initial = {
  id?: string;
  type: string;
  title: string;
  description: string;
  category: string;
  city: string;
  address: string;
  priceLabel: string;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  photoUrl: string;
};

const initialState: ActionState = { error: "" };

export function ListingForm({ mode, initial }: { mode: "create" | "edit"; initial: Initial }) {
  const action = mode === "create" ? createListing : updateListing;
  const [state, formAction] = useActionState(action, initialState);
  const [prompt, setPrompt] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [city, setCity] = useState(initial.city);
  const [type, setType] = useState(initial.type);

  function applyDraft() {
    const draft = draftListing(prompt);
    if (draft.error) {
      setNote(draft.error);
      return;
    }
    setTitle(draft.title);
    setDescription(draft.description);
    setCategory(draft.category);
    setCity(draft.city);
    setType(draft.type);
    setNote(draft.note);
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-sand bg-sand/40 p-4">
        <label className="block text-sm font-medium" htmlFor="draft-prompt">
          Listing assist
        </label>
        <p className="mt-1 text-sm text-ink/70">
          Describe the business or advert in one sentence. This fills the form on this device. It does not publish anything.
        </p>
        <textarea
          id="draft-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className={fieldClass}
          placeholder="Fish restaurant in Kilimani, lunch plates and weekend catering"
        />
        <button type="button" onClick={applyDraft} className={`${btnSecondary} mt-3`}>
          Draft fields
        </button>
        {note ? <p className="mt-2 text-sm text-ink/80">{note}</p> : null}
      </div>

      <form action={formAction} className="grid gap-4">
        <ErrorNote>{state.error}</ErrorNote>
        {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
        <label className="block text-sm">
          Type
          <select name="type" value={type} onChange={(event) => setType(event.target.value)} className={fieldClass}>
            {LISTING_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label} — {item.blurb}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Title
          <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={80} className={fieldClass} />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={6}
            maxLength={4000}
            className={fieldClass}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Category
            <select name="category" value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            City
            <select name="city" value={city} onChange={(event) => setCity(event.target.value)} className={fieldClass}>
              {CITIES.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.region})
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Address or area
          <input name="address" defaultValue={initial.address} maxLength={160} className={fieldClass} />
        </label>
        <label className="block text-sm">
          Price <span className="text-ink/60">(optional, shown as you type it)</span>
          <input name="priceLabel" defaultValue={initial.priceLabel} maxLength={40} placeholder="KES 1,500 or £40" className={fieldClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Contact name
            <input name="contactName" defaultValue={initial.contactName} maxLength={80} className={fieldClass} />
          </label>
          <label className="block text-sm">
            Phone
            <input name="contactPhone" defaultValue={initial.contactPhone} maxLength={32} className={fieldClass} />
          </label>
        </div>
        <label className="block text-sm">
          WhatsApp number
          <input name="contactWhatsapp" defaultValue={initial.contactWhatsapp} maxLength={32} placeholder="+2547…" className={fieldClass} />
        </label>
        <PhotoField
          name="photoUrl"
          label="Photo"
          purpose="listing"
          resourceId={initial.id}
          defaultUrl={initial.photoUrl}
          hint="Optional. Shows on the listing. Drop a photo, or choose one from this phone or computer. Large photos are resized first."
        />
        <SubmitButton className={btnPrimary} pendingLabel="Saving…">
          {mode === "create" ? "Publish listing" : "Save changes"}
        </SubmitButton>
      </form>
    </div>
  );
}
