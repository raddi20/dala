"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateStorefront } from "@/lib/actions/storefront";
import { FREE_OFFERING_CAP, PRO_OFFERING_CAP } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { PhotoField } from "@/components/photo-field";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function StorefrontSettingsForm({
  slug,
  bannerUrl,
  bio,
  published,
  verifiedPro,
  servesDiaspora,
  occasions,
  selectedOccasions,
  emphasizePublish = false,
}: {
  slug: string;
  bannerUrl: string;
  bio: string;
  published: boolean;
  verifiedPro: boolean;
  servesDiaspora: boolean;
  occasions: { slug: string; title: string }[];
  selectedOccasions: string[];
  emphasizePublish?: boolean;
}) {
  const [state, action] = useActionState(updateStorefront, initial);

  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <label className="block text-sm">
        Shop address
        <div className="mt-1 flex items-center gap-2">
          <span className="text-ink/60">/b/</span>
          <input name="slug" defaultValue={slug} required maxLength={40} className={`${fieldClass} mt-0`} />
        </div>
      </label>
      <p className="text-sm text-ink/70">
        The name on the shop is your profile name. Change that on Account. The address stays put until you edit it here.
      </p>
      <label className="block text-sm">
        About
        {!bio ? <span className="mt-1 block text-ink/70">Your profile has no about text yet. A sentence is enough.</span> : null}
        <textarea name="bio" defaultValue={bio} rows={4} maxLength={500} className={fieldClass} />
      </label>
      {verifiedPro ? (
        <PhotoField
          name="bannerUrl"
          label="Cover photo"
          purpose="banner"
          defaultUrl={bannerUrl}
          hint="One wide photo at the top of your shop. Drop it here, or choose it from this phone or computer. Verified Pro includes this."
        />
      ) : (
        <p className="rounded-xl bg-amber-soft/80 px-3.5 py-2.5 text-sm text-ink/80">
          A cover banner is included with Verified Pro, along with {PRO_OFFERING_CAP} offerings instead of {FREE_OFFERING_CAP}.{" "}
          <Link href="/pricing" className="font-semibold text-lake-dark hover:text-lake">
            See prices
          </Link>
          {" · "}
          <Link href="/upgrade?product=verified_pro" className="font-semibold text-lake-dark hover:text-lake">
            See Promote
          </Link>
        </p>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="hidden" name="servesDiaspora" value="0" />
        <input type="checkbox" name="servesDiaspora" value="1" defaultChecked={servesDiaspora} className="mt-1" />
        <span>
          <span className="font-semibold">Serves diaspora orders</span>
          <span className="mt-1 block text-ink/70">
            People in London, or elsewhere abroad, can see that you will take a WhatsApp order for family at home. You
            still arrange it in the chat. Rangach does not take payment.
          </span>
        </span>
      </label>
      {occasions.length > 0 ? (
        <fieldset className="grid gap-2">
          <input type="hidden" name="occasionsPresent" value="1" />
          <legend className="text-sm font-semibold text-navy">Occasions you can help with</legend>
          <p className="text-sm text-ink/70">
            Tick the moments you take work for. Your shop can then show on that occasion page. Buyers still message you
            on WhatsApp.
          </p>
          {occasions.map((occasion) => (
            <label key={occasion.slug} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="occasion"
                value={occasion.slug}
                defaultChecked={selectedOccasions.includes(occasion.slug)}
                className="mt-1"
              />
              <span>{occasion.title}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <label
        id="published"
        className={
          emphasizePublish
            ? "flex items-start gap-2 rounded-xl bg-amber-soft/80 px-3 py-3 text-sm ring-1 ring-clay/30"
            : "flex items-start gap-2 text-sm"
        }
      >
        <input type="hidden" name="published" value="0" />
        <input type="checkbox" name="published" value="1" defaultChecked={published} className="mt-1" />
        <span>
          <span className="font-semibold">Published</span>
          <span className="mt-1 block text-ink/70">
            Buyers with the link can open the shop. While this is off, only you can preview it.
          </span>
        </span>
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Saving…">
        Save shop
      </SubmitButton>
    </form>
  );
}
