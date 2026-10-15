import type { Metadata } from "next";
import Link from "next/link";
import { BusinessLeadForm } from "@/components/business-lead-form";
import { BusinessTierSection } from "@/components/business-tiers";
import { cardClass } from "@/components/ui";
import { AUDIENCE_LINE } from "@/lib/brand";
import { cleanRefCode } from "@/lib/business-lead";
import { businessTierById, KISUMU_SHEET_PATH } from "@/lib/business-tiers";
import { kesPerGbp, kesPerUsd } from "@/lib/pricing-display";
import { paymentsLive } from "@/lib/payments/live";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, needsLiveRates } from "@/lib/visitor-currency";
import { one } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Rangach Business",
  description:
    "Duka Starter, Duka Pro, and Business plans for shops in Kenya, East Africa and the Diaspora. The first month of Duka Starter is free. Billing is by hand.",
};

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const refCode = cleanRefCode(one(params.ref));
  const agentCode = one(params.agent).trim().slice(0, 16);
  const tier = businessTierById(one(params.tier))?.id ?? "starter";
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <BusinessTierSection
        country={country}
        rates={rates}
        kesPerUsd={kesPerUsd()}
        kesPerGbp={kesPerGbp()}
        live={paymentsLive()}
        refCode={refCode}
      />
      <section className={`${cardClass} grid gap-4 p-5 sm:p-6`}>
        <div>
          <h2 className="font-serif text-2xl text-navy">Tell us about the shop</h2>
          <p className="mt-2 text-sm text-ink/70">
            {AUDIENCE_LINE}. Leave your details and we will contact you. We do not take a card payment here.
          </p>
        </div>
        <BusinessLeadForm tier={tier} refCode={refCode} agentCode={agentCode} />
      </section>
      <p className="text-sm text-ink/70">
        <Link href={KISUMU_SHEET_PATH} className="font-semibold text-lake-dark hover:text-lake">
          Print the Kisumu sheet
        </Link>
      </p>
    </div>
  );
}
