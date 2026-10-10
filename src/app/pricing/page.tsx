import type { Metadata } from "next";
import { UpgradeAction } from "@/components/upgrade-action";
import { btnPrimary, btnSecondary, cardClass, sectionTitleClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { CHARGE, FEATURED_DAYS, FREE_OFFERING_CAP, PRO_DAYS } from "@/lib/constants";
import { kesPerUsd, pricingPlans } from "@/lib/pricing-display";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, needsLiveRates, visitorPrice } from "@/lib/visitor-currency";
import { paymentsLive } from "@/lib/payments/live";
import { publicOrigin } from "@/lib/payments/origin";
import { getSessionUser } from "@/lib/session";
import { buildShareMetadata } from "@/lib/share-metadata";
import { continueHref } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const name = appName();
  return buildShareMetadata({
    origin,
    path: "/pricing",
    title: "Pricing",
    description: `Featured and Verified Pro prices on ${name}. Outside Kenya and the United Kingdom the figure is approximate. The Pro plan is not a verification badge.`,
    image: "/pricing/opengraph-image",
    imageAlt: `Pricing on ${name}`,
  });
}

export default async function PricingPage() {
  const user = await getSessionUser();
  const live = paymentsLive();
  const plans = pricingPlans();
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const shillingsPerDollar = kesPerUsd();
  const shownPlans = plans.map((plan) => ({
    plan,
    price: visitorPrice({
      country,
      kes: CHARGE[plan.product].Nairobi,
      gbp: CHARGE[plan.product].London,
      rates,
      kesPerUsd: shillingsPerDollar,
    }),
  }));
  const proPrice = shownPlans.find((item) => item.plan.product === "verified_pro")?.price;
  const proLabel =
    !proPrice || proPrice.kind === "charges" ? `${CHARGE.verified_pro.Nairobi.label} / ${CHARGE.verified_pro.London.label}` : proPrice.label;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">Kenya, East Africa and the Diaspora</p>
        <h1 className={`${sectionTitleClass} mt-2`}>Pricing</h1>
        <p className="mt-3 max-w-2xl text-ink/70">
          Listing a business is free. A free shop lists {FREE_OFFERING_CAP} offerings. Featured is a directory boost for {FEATURED_DAYS} days. Verified Pro is {proLabel} per {PRO_DAYS} days, and renewing early adds {PRO_DAYS} days to the current end date. There is no cart. Payment for goods stays on WhatsApp, between buyer and seller.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shownPlans.map(({ plan, price }) => {
          const href = continueHref(Boolean(user), `/upgrade?product=${plan.product}`);
          return (
            <section key={plan.product} className={`${cardClass} flex flex-col p-6`}>
              <h2 className="font-serif text-2xl text-navy">{plan.name}</h2>
              <p className="mt-2 text-sm text-ink/70">
                {price.kind === "charges"
                  ? plan.summary
                  : plan.summary.replace(
                      `${CHARGE.verified_pro.Nairobi.label} / ${CHARGE.verified_pro.London.label}`,
                      price.label,
                    )}
              </p>
              <p className="mt-5 font-serif text-4xl text-navy">{price.kind === "charges" ? price.kesLabel : price.label}</p>
              {live ? null : <p className="text-sm font-semibold text-clay-dark">Coming soon</p>}
              {plan.period ? <p className="text-sm font-semibold text-navy">{plan.period}</p> : null}
              {price.kind === "charges" ? (
                <>
                  <p className="text-sm text-ink/60">Kenya and East Africa price. This is what checkout charges there.</p>
                  <ul className="mt-4 grid gap-2 text-sm">
                    <li className="flex items-baseline justify-between gap-3 rounded-xl bg-paper px-3 py-2">
                      <span className="font-semibold text-navy">{price.gbpLabel}</span>
                      <span className="text-ink/60">Diaspora price</span>
                    </li>
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/60">{price.caption}</p>
              )}
              <h3 className="mt-5 text-sm font-semibold text-navy">Includes</h3>
              <ul className="mt-2 grid gap-1.5 text-sm text-ink/80">
                {plan.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3 className="mt-4 text-sm font-semibold text-navy">Does not include</h3>
              <ul className="mt-2 grid gap-1.5 text-sm text-ink/70">
                {plan.notIncluded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <UpgradeAction
                live={live}
                href={href}
                label={user ? "Continue on Promote" : "Sign in to promote"}
                className={`${btnPrimary} mt-6`}
              />
            </section>
          );
        })}
      </div>

      <section className={`${cardClass} border-lake/30 bg-teal-soft/60 p-5`}>
        <h2 className="font-serif text-xl text-navy">Verified Pro is not “verified”</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          Paying for Verified Pro turns on the Pro plan for {PRO_DAYS} days: the cover banner, the shop video, and the higher offering limit. Renewing before it ends adds {PRO_DAYS} days to the current end date. It does not check a phone, a place, or a business, and it does not add the green Verified badge on a listing. An admin grants those. The price above is the plan, not a promise that someone inspected the shop.
        </p>
      </section>

      <p className="max-w-3xl text-sm leading-relaxed text-ink/60">{shownPlans[0]?.price.caption}</p>
      <p className="text-sm text-ink/60">
        Already signed in?{" "}
        <UpgradeAction live={live} href="/upgrade" label="Open Promote" className={`${btnSecondary} ml-1`} />
      </p>
    </div>
  );
}
