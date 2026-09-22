"use client";

import { useActionState, useState } from "react";
import { startPayment } from "@/lib/actions/payments";
import { PaymentSetup } from "@/components/payment-setup";
import { SubmitButton } from "@/components/submit-button";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { chargeFor, FREE_OFFERING_CAP, PRO_OFFERING_CAP, type PaidProduct } from "@/lib/constants";
import type { PaymentMode } from "@/lib/payments/rules";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function PayForm({
  listings,
  defaultListingId,
  defaultProduct,
  userCity,
  verifiedPro,
  mode,
  webhookReady,
}: {
  listings: { id: string; title: string; city: string }[];
  defaultListingId: string;
  defaultProduct: PaidProduct;
  userCity: string;
  verifiedPro: boolean;
  mode: PaymentMode;
  webhookReady: boolean;
}) {
  const [state, action] = useActionState(startPayment, initial);
  const [product, setProduct] = useState<PaidProduct>(defaultProduct);
  const initialListingId = listings.some((listing) => listing.id === defaultListingId)
    ? defaultListingId
    : (listings[0]?.id ?? "");
  const [listingId, setListingId] = useState(initialListingId);
  const initialCity =
    defaultProduct === "featured"
      ? (listings.find((listing) => listing.id === initialListingId)?.city ?? userCity)
      : userCity;
  const [methodChoice, setMethodChoice] = useState<"mpesa" | "card">(
    chargeFor(defaultProduct, initialCity).currency === "KES" ? "mpesa" : "card",
  );

  const listingCity = listings.find((listing) => listing.id === listingId)?.city ?? userCity;
  const city = product === "featured" ? listingCity : userCity;
  const charge = chargeFor(product, city);
  const mpesaOk = charge.currency === "KES";
  const method: "mpesa" | "card" = mpesaOk ? methodChoice : "card";
  const configured = mode === "test" || mode === "live";
  const blocked =
    !configured ||
    (product === "featured" && listings.length === 0) ||
    (product === "verified_pro" && verifiedPro);

  return (
    <form action={action} className="grid gap-4">
      <PaymentSetup mode={mode} webhookReady={webhookReady} />
      <ErrorNote>{state.error}</ErrorNote>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Product</legend>
        <label className="flex gap-2 rounded-lg border border-sand bg-white p-3 text-sm">
          <input type="radio" name="product" value="featured" checked={product === "featured"} onChange={() => setProduct("featured")} />
          <span>
            <span className="font-semibold">Featured listing</span>
            <span className="mt-1 block text-ink/70">
              30 days at the top of browse. {chargeFor("featured", "Nairobi").label} in Nairobi, {chargeFor("featured", "London").label} in London.
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
              A paid badge on your profile and listings, a cover banner, and up to {PRO_OFFERING_CAP} offerings on your shop.
              Free shops list {FREE_OFFERING_CAP}. {chargeFor("verified_pro", "Nairobi").label} in Nairobi,{" "}
              {chargeFor("verified_pro", "London").label} in London. The green Verified badge is still an admin action.
              {verifiedPro ? " You already have this." : ""}
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
            <select
              name="listingId"
              value={listingId}
              onChange={(event) => setListingId(event.target.value)}
              className={fieldClass}
            >
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
            <input
              type="radio"
              name="method"
              value="mpesa"
              checked={method === "mpesa"}
              disabled={!mpesaOk}
              onChange={() => setMethodChoice("mpesa")}
            />
            M-Pesa
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-sand bg-white px-3 py-2 text-sm">
            <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethodChoice("card")} />
            Card
          </label>
        </div>
        {mpesaOk ? null : (
          <p className="text-sm text-ink/70">This price is in pounds. M-Pesa only charges Kenyan shillings, so card is the way to pay.</p>
        )}
      </fieldset>

      {method === "mpesa" ? (
        <label className="block text-sm">
          M-Pesa phone
          <input name="phone" inputMode="tel" placeholder="2547… or 07…" className={fieldClass} />
          <span className="mt-1 block text-ink/60">Flutterwave sends the prompt. Dala does not talk to Safaricom directly.</span>
        </label>
      ) : (
        <p className="text-sm text-ink/70">The card number is entered on Flutterwave, not on Dala.</p>
      )}

      <p className="text-sm font-semibold text-navy">
        {product === "featured" ? "Featured listing" : "Verified Pro"} · {charge.label}
      </p>
      <SubmitButton className={btnPrimary} pendingLabel="Opening checkout…" disabled={blocked}>
        {configured ? `Pay ${charge.label}` : "Checkout needs Flutterwave keys"}
      </SubmitButton>
    </form>
  );
}
