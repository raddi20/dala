import Link from "next/link";
import { AUDIENCE_LINE } from "@/lib/brand";
import { businessInterestHref } from "@/lib/business-lead";
import {
  BUSINESS_ANNUAL,
  BUSINESS_EXAMPLE,
  BUSINESS_HAND_BILLING,
  BUSINESS_PITCH,
  BUSINESS_TIERS,
  tierPriceView,
  type BusinessTier,
} from "@/lib/business-tiers";
import { PAID_UPGRADES_COMING_SOON } from "@/lib/payments/live";
import { btnPrimary, cardClass, sectionTitleClass } from "@/components/ui";

export function BusinessTierSection({
  country,
  rates,
  kesPerUsd,
  kesPerGbp,
  live,
  refCode = "",
}: {
  country: string | null | undefined;
  rates: Record<string, number> | null;
  kesPerUsd: number;
  kesPerGbp: number;
  live: boolean;
  refCode?: string;
}) {
  return (
    <section id="business" className="grid gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h2 className={`${sectionTitleClass} mt-2`}>Rangach Business</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/80">{BUSINESS_PITCH}</p>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">{BUSINESS_EXAMPLE}</p>
      </div>
      {live ? (
        <p className="text-sm text-ink/70">{BUSINESS_HAND_BILLING}</p>
      ) : (
        <p className="text-sm font-semibold text-clay-dark">
          {PAID_UPGRADES_COMING_SOON}. You can still leave your details. {BUSINESS_HAND_BILLING}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {BUSINESS_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            price={tierPriceView(tier, { country, rates, kesPerUsd, kesPerGbp })}
            href={businessInterestHref(tier.id, refCode)}
          />
        ))}
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-ink/60">{BUSINESS_ANNUAL}</p>
    </section>
  );
}

function TierCard({
  tier,
  price,
  href,
}: {
  tier: BusinessTier;
  price: { primary: string; secondary: string | null; caption: string };
  href: string;
}) {
  return (
    <article className={`${cardClass} flex flex-col p-5`}>
      <h3 className="font-serif text-2xl text-navy">{tier.name}</h3>
      <p className="mt-3 font-serif text-3xl text-navy">{price.primary}</p>
      {tier.contactUs ? <p className="text-sm font-semibold text-navy">Contact us</p> : null}
      {tier.offer ? <p className="text-sm font-semibold text-lake-dark">{tier.offer}</p> : null}
      <p className="text-sm text-ink/60">{tier.period}</p>
      {price.secondary ? (
        <p className="mt-2 text-sm text-ink/70">
          <span className="font-semibold text-navy">{price.secondary}</span>
          <span className="text-ink/60"> · Diaspora approximation</span>
        </p>
      ) : null}
      <p className="mt-2 text-sm text-ink/60">{price.caption}</p>
      <ul className="mt-4 grid flex-1 gap-1.5 text-sm text-ink/80">
        {tier.includes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Link href={href} className={`${btnPrimary} mt-5`}>
        {tier.contactUs ? "Contact us" : "I'm interested"}
      </Link>
    </article>
  );
}
