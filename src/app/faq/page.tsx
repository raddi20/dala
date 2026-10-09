import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import {
  CHARGE,
  FEATURED_DAYS,
  FREE_OFFERING_CAP,
  PRO_OFFERING_CAP,
  REPORT_REASONS,
} from "@/lib/constants";
import { DIASPORA_ORDERS_EXPLANATION, DIASPORA_ORDERS_LABEL } from "@/lib/diaspora";
import { kesPerUsd, pricingPlans } from "@/lib/pricing-display";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, needsLiveRates, visitorPrice } from "@/lib/visitor-currency";
import { CONTACT_EMAIL, LICENSED_PAYMENT_PROVIDER, featuredDurationCopy, publicInfoPage, verifiedProDurationCopy } from "@/lib/public-info";
import {
  DOCUMENTS_SEEN_NOTE,
  PRO_PLAN_LABEL,
  SHOP_BADGE_METHODS,
  SHOP_BADGES,
} from "@/lib/shop-badges";
import { MAX_DURATION_SECONDS, REJECT_PURGE_DAYS, UPLOADS_PER_DAY } from "@/lib/video/constants";

const page = publicInfoPage("/faq");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

export default async function FaqPage() {
  const name = appName();
  const plans = pricingPlans();
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const shillingsPerDollar = kesPerUsd();
  const methods = SHOP_BADGE_METHODS.map((method) => method.label).join(", ");

  return (
    <InfoPage
      path="/faq"
      kicker="Questions"
      title="FAQ"
      lede={`Listing on ${name} is free. There is no cart. When you buy something, you pay the seller yourselves. These answers match what the site does today.`}
    >
      <InfoSection title="The free shop">
        <p>
          A free shop can list {FREE_OFFERING_CAP} offerings that are active. Archived offerings do not count toward
          that limit. The shop page is where a buyer sees those offerings and the WhatsApp button.
        </p>
        <p>
          The Pro plan is paid. It raises the limit to {PRO_OFFERING_CAP} active offerings and adds a cover banner. A
          free shop stays at {FREE_OFFERING_CAP}.
        </p>
      </InfoSection>

      <InfoSection title="Featured and Verified Pro">
        <p>
          These are the only things you pay {name} for. The prices below are the same ones checkout charges. The{" "}
          <Link href="/pricing" className="font-semibold text-lake-dark hover:text-lake">
            pricing page
          </Link>{" "}
          shows one price in your currency. Outside Kenya and the United Kingdom that figure is approximate and is not what you pay.
        </p>
        {plans.map((plan) => {
          const price = visitorPrice({
            country,
            kes: CHARGE[plan.product].Nairobi,
            gbp: CHARGE[plan.product].London,
            rates,
            kesPerUsd: shillingsPerDollar,
          });
          return (
          <div key={plan.product} className="grid gap-2 rounded-xl bg-paper px-3 py-3">
            <h3 className="font-serif text-lg text-navy">{plan.name}</h3>
            <p>
              {price.kind === "charges"
                ? plan.summary
                : plan.summary.replace(
                    `${CHARGE.verified_pro.Nairobi.label} / ${CHARGE.verified_pro.London.label}`,
                    price.label,
                  )}
            </p>
            <p>
              {price.kind === "charges" ? (
                <>
                  <span className="font-semibold text-navy">{price.kesLabel}</span> for shops in Kenya and East Africa.{" "}
                  <span className="font-semibold text-navy">{price.gbpLabel}</span> for Diaspora shops.
                </>
              ) : (
                <>
                  <span className="font-semibold text-navy">{price.label}</span>. {price.caption}{" "}
                </>
              )}
              {plan.product === "featured"
                ? " Featured is priced for the listing’s city."
                : " Verified Pro is priced for the city on your account."}
            </p>
            <ul className="grid gap-1">
              {plan.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          );
        })}
        <p>{featuredDurationCopy()} It applies to the one listing you choose. It does not verify that listing, and it does not change the shop.</p>
        <p>{verifiedProDurationCopy()}</p>
        <p>
          On the shop and on listings, the paid plan is labelled {PRO_PLAN_LABEL}. An admin can also turn that plan on
          or off. Paying, or an admin switch, does not grant Phone verified, Location verified, or Business verified.
        </p>
        <p>
          You pay on the Promote page after you sign in. Prices for shops in Kenya and East Africa are Kenyan shillings and can be M-Pesa or a
          card. Diaspora prices are pounds. M-Pesa only charges shillings, so a Diaspora price is paid by card. Payment
          is taken by {LICENSED_PAYMENT_PROVIDER}. The plan does not renew unless you pay again. {name} does not see
          your card number.
        </p>
      </InfoSection>

      <InfoSection title="Verified Pro is not a verification badge">
        <p>
          Paying for Verified Pro buys the paid plan: the cover banner, up to {PRO_OFFERING_CAP} offerings, and one
          shop video after an admin reviews it. It does not mean someone has checked the phone, the place, or the
          business. The green Verified badge on a listing is a separate admin action. It is not included in the price.
        </p>
        <p>Featured is {FEATURED_DAYS} days in the directory. It is not a badge either.</p>
      </InfoSection>

      <InfoSection title="Verification badges">
        <p>An admin grants these. A payment cannot.</p>
        <ul className="grid gap-2">
          {SHOP_BADGES.map((badge) => (
            <li key={badge.key}>
              <span className="font-semibold text-navy">{badge.label}.</span> {badge.explanation}
            </li>
          ))}
        </ul>
        <p>The admin records how they checked: {methods}. The shop can show that method and the date of the check.</p>
        <p>{DOCUMENTS_SEEN_NOTE}</p>
        <p>
          A listing can also carry a green Verified badge. An admin adds or removes that on the listing. It is not the
          same as the three shop badges, and it is not the Pro plan.
        </p>
      </InfoSection>

      <InfoSection title="Shop videos">
        <p>
          A shop on the Pro plan can upload one video, up to {MAX_DURATION_SECONDS} seconds. The file goes to Mux, the
          video host, and it stays private until an admin has watched it and approved it. A shop can start{" "}
          {UPLOADS_PER_DAY === 1 ? "one new upload" : `${UPLOADS_PER_DAY} new uploads`} every 24 hours. You tick a box
          that you have the rights to the picture and any music, and the
          consent of anyone who is shown.
        </p>
        <p>
          A video longer than {MAX_DURATION_SECONDS} seconds is deleted straight away. A rejected video is deleted from
          Mux after {REJECT_PURGE_DAYS} days. The reason is kept. If the Pro plan is turned off, an approved video is
          hidden from the shop and from link previews. The file is kept, and it can show again when Pro is on.
        </p>
        <p>
          The{" "}
          <Link href="/video-policy" className="font-semibold text-lake-dark hover:text-lake">
            video policy
          </Link>{" "}
          has the rest, including how to ask for a takedown.
        </p>
      </InfoSection>

      <InfoSection title="Buying for family back home">
        <p>
          On a listing or a shop that has a WhatsApp number, you can open “Buying for family back home?”. It writes a
          short note and opens WhatsApp to the seller. You can add what you need, who it is for, the town or area, the
          date, and who is paying. Those fields are optional.
        </p>
        <p>
          {name} does not save that note, and it does not take the payment or make a booking. The chat and the money
          stay between you and the seller.
        </p>
        <p>
          A shop can turn on a tag, {DIASPORA_ORDERS_LABEL}. {DIASPORA_ORDERS_EXPLANATION}
        </p>
        <p>
          If the writing helper is switched on, you can describe the order in one sentence and it fills the form. That
          sentence is not saved on {name}. You can always fill the form yourself.
        </p>
      </InfoSection>

      <InfoSection title="Reporting a listing">
        <p>
          Sign in, then open Report this listing, Report this shop, or Report this profile. The reasons are{" "}
          {REPORT_REASONS.join(", ")}. Add a short detail if you can. A moderator sees it in the admin queue and can
          hide the listing.
        </p>
        <p>
          You can also block a person. Their other listings are then hidden from your own browse. Blocking does not
          delete their account.
        </p>
      </InfoSection>

      <InfoSection title="Contact">
        <p>
          Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>
          . That is the address for questions about a listing, a payment for Featured or Verified Pro, or your account.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
