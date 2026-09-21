"use client";

import { useActionState, useState } from "react";
import { startPayment } from "@/lib/actions/payments";
import { PRICES } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function PayForm({
  listings,
  defaultListingId,
}: {
  listings: { id: string; title: string; city: string }[];
  defaultListingId: string;
}) {
  const [state, action] = useActionState(startPayment, initial);
  const [product, setProduct] = useState<"featured" | "verified_pro">("featured");
  const [method, setMethod] = useState<"mpesa" | "card">("mpesa");

  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Product</legend>
        <label className="flex gap-2 rounded-lg border border-sand bg-white p-3 text-sm">
          <input type="radio" name="product" value="featured" checked={product === "featured"} onChange={() => setProduct("featured")} />
          <span>
            <span className="font-semibold">Featured listing</span>
            <span className="mt-1 block text-ink/70">
              30 days at the top of browse. {PRICES.featured.Nairobi} in Nairobi, {PRICES.featured.London} in London.
            </span>
          </span>
        </label>
        <label className="flex gap-2 rounded-lg border border-sand bg-white p-3 text-sm">
          <input
            type="radio"
            name="product"
            value="verified_pro"
            checked={product === "verified_pro"}
            onChange={() => setProduct("verified_pro")}
          />
          <span>
            <span className="font-semibold">Verified Pro</span>
            <span className="mt-1 block text-ink/70">
              A paid badge on your profile and listings. {PRICES.verified_pro.Nairobi} or {PRICES.verified_pro.London}. Manual
              verification is still an admin action.
            </span>
          </span>
        </label>
      </fieldset>

      {product === "featured" ? (
        <label className="block text-sm">
          Listing
          {listings.length === 0 ? (
            <p className="mt-1 text-ink/70">Post a listing before featuring one.</p>
          ) : (
            <select name="listingId" defaultValue={defaultListingId || listings[0]?.id} className={fieldClass}>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title} ({listing.city})
                </option>
              ))}
            </select>
          )}
        </label>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Method</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-sand bg-white px-3 py-2 text-sm">
            <input type="radio" name="method" value="mpesa" checked={method === "mpesa"} onChange={() => setMethod("mpesa")} />
            M-Pesa
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-sand bg-white px-3 py-2 text-sm">
            <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} />
            Card
          </label>
        </div>
      </fieldset>

      {method === "mpesa" ? (
        <label className="block text-sm">
          M-Pesa phone
          <input name="phone" inputMode="tel" placeholder="2547…" className={fieldClass} />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-3">
            Card number
            <input name="card" inputMode="numeric" autoComplete="off" placeholder="4242424242424242" className={fieldClass} />
          </label>
          <label className="block text-sm">
            Expiry
            <input name="expiry" placeholder="12/28" autoComplete="off" className={fieldClass} />
          </label>
          <label className="block text-sm">
            CVC
            <input name="cvc" inputMode="numeric" autoComplete="off" placeholder="123" className={fieldClass} />
          </label>
        </div>
      )}

      <p className="text-sm text-ink/70">
        Demo checkout. Dala does not send an STK push and does not charge a card. The receipt is stored locally so the badge can update.
      </p>
      <SubmitButton className={btnPrimary} pendingLabel="Simulating…">
        Simulate payment
      </SubmitButton>
    </form>
  );
}
