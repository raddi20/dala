"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateStorefront } from "@/lib/actions/storefront";
import { FREE_OFFERING_CAP, PRO_OFFERING_CAP } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function StorefrontSettingsForm({
  slug,
  bannerUrl,
  bio,
  published,
  verifiedPro,
}: {
  slug: string;
  bannerUrl: string;
  bio: string;
  published: boolean;
  verifiedPro: boolean;
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
        <label className="block text-sm">
          Cover banner URL
          <input name="bannerUrl" defaultValue={bannerUrl} placeholder="https://" className={fieldClass} />
          <span className="mt-1 block text-ink/60">One wide photo. Verified Pro includes this.</span>
        </label>
      ) : (
        <p className="rounded-lg bg-sand/60 px-3 py-2 text-sm">
          A cover banner is included with Verified Pro, along with {PRO_OFFERING_CAP} offerings instead of {FREE_OFFERING_CAP}.{" "}
          <Link href="/upgrade" className="font-semibold text-lake-dark">
            See Promote
          </Link>
        </p>
      )}
      <label className="flex items-start gap-2 text-sm">
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
