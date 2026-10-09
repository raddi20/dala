import type { Metadata } from "next";
import Link from "next/link";
import { EntityContact } from "@/components/entity-contact";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import { CHARGE, FEATURED_DAYS, PRO_DAYS, productLabel } from "@/lib/constants";
import { kesPerUsd } from "@/lib/pricing-display";
import {
  CONTACT_EMAIL,
  LEGAL_DRAFT_NOTE,
  LICENSED_PAYMENT_PROVIDER,
  featuredDurationCopy,
  legalEntityLabel,
  publicInfoPage,
  verifiedProDurationCopy,
} from "@/lib/public-info";
import { PAID_UPGRADES_COMING_SOON, paymentsLive } from "@/lib/payments/live";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, needsLiveRates, visitorPrice, type VisitorPrice } from "@/lib/visitor-currency";

const page = publicInfoPage("/refund");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

function refundCurrencyNote(price: VisitorPrice) {
  if (price.kind === "approx") {
    return `The pricing page shows an approximate local figure (${price.label}) for shops in Kenya and East Africa. Payment is charged in Kenyan shillings for those shops, or in pounds for Diaspora shops. A refund returns the Kenyan shillings or pounds that were charged, not that approximate figure.`;
  }
  if (price.kind === "exact") {
    return price.caption.includes("pounds")
      ? "The pricing page shows the pound charge for Diaspora shops. A refund returns that charge in pounds, not a converted amount."
      : "The pricing page shows the Kenyan shilling charge for shops in Kenya and East Africa. A refund returns that charge in Kenyan shillings, not a converted amount.";
  }
  return `The pricing page shows the charges: ${price.kesLabel} for shops in Kenya and East Africa and ${price.gbpLabel} for Diaspora shops. A refund returns the currency that was charged, Kenyan shillings or pounds. An approximate local figure is not the amount charged and it is not a separate refund.`;
}

export default async function RefundPage() {
  const name = appName();
  const live = paymentsLive();
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const shown = visitorPrice({
    country,
    kes: CHARGE.featured.Nairobi,
    gbp: CHARGE.featured.London,
    rates,
    kesPerUsd: kesPerUsd(),
  });

  return (
    <InfoPage
      path="/refund"
      kicker="Refunds and cancellation"
      title="Refunds"
      notice={LEGAL_DRAFT_NOTE}
      lede={`${legalEntityLabel()} sells only Featured and Verified Pro on ${name}. Those are paid places on this directory. They are not a payment for goods, housing, or a service between a buyer and a seller.`}
    >
      <InfoSection title="What this covers">
        <p>
          {productLabel("featured")} and {productLabel("verified_pro")} are the only payments {name} takes.{" "}
          {featuredDurationCopy()} {verifiedProDurationCopy()} The{" "}
          <Link href="/pricing" className="font-semibold text-lake-dark hover:text-lake">
            pricing page
          </Link>{" "}
          shows the prices. {refundCurrencyNote(shown)}
        </p>
        <p>
          A deal between a buyer and a seller is not covered here. {name} does not hold that money, so it cannot refund
          it. The chat stays on WhatsApp.
        </p>
      </InfoSection>

      <InfoSection title="What can be refunded">
        <p>We refund a Featured or Verified Pro payment in these cases:</p>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>the charge did not turn the upgrade on</li>
          <li>the same upgrade was charged twice</li>
          <li>we cannot provide the upgrade at all</li>
          <li>the law requires a refund</li>
        </ul>
        {live ? (
          <p>
            Payment is collected by {LICENSED_PAYMENT_PROVIDER}, by M-Pesa where the price is in shillings, or by card. We
            do not store the card number.
          </p>
        ) : (
          <p>
            {PAID_UPGRADES_COMING_SOON}. A charge that was already taken was collected by {LICENSED_PAYMENT_PROVIDER}. We
            do not store the card number.
          </p>
        )}
      </InfoSection>

      <InfoSection title="What is not refunded">
        <p>
          Once Featured or Verified Pro has started, we do not refund that payment, except where the law requires a
          refund. Paying does not buy a verification badge.
        </p>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>days left on a plan you choose not to use</li>
          <li>a plan we turn off, or a listing we hide, because it breaks the terms</li>
          <li>money you pay a seller directly</li>
        </ul>
      </InfoSection>

      <InfoSection title="Cancellation">
        <p>
          Neither plan renews by itself. Featured lasts {FEATURED_DAYS} days. Verified Pro lasts {PRO_DAYS} days.
          When that time ends, the extra features stop unless you pay again. Renewing before the end date adds another
          period of the same length.{" "}
          {live
            ? "Nothing charges a card or M-Pesa again unless you start a new payment."
            : `Nothing charges a card or M-Pesa again. ${PAID_UPGRADES_COMING_SOON}.`}
        </p>
        <p>
          You cancel by not paying again. You can also email {CONTACT_EMAIL} and ask us to stop an upgrade early. We
          take the extra features down from the date we confirm. Stopping early does not by itself refund the days
          already paid.
        </p>
      </InfoSection>

      <InfoSection title="How to ask">
        <p>
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>{" "}
          from the account email if you can. Include the payment reference, the date, whether it was Featured or
          Verified Pro, and what went wrong.
        </p>
        <p>
          We aim to reply within 5 business days. Where we agree a refund is due, we ask {LICENSED_PAYMENT_PROVIDER} to
          return the money within 14 days of that reply. The money goes back by the same method, in the currency that
          was charged. The provider’s own timing sits on top of ours.
        </p>
      </InfoSection>

      <InfoSection title="Contact">
        <EntityContact />
      </InfoSection>
    </InfoPage>
  );
}
