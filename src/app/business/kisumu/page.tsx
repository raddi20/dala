import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { StickerQr } from "@/components/sticker-sheet";
import { Wordmark } from "@/components/wordmark";
import { btnSecondary } from "@/components/ui";
import { AUDIENCE_LINE } from "@/lib/brand";
import {
  BUSINESS_ANNUAL,
  BUSINESS_EXAMPLE,
  BUSINESS_OBJECTIONS,
  BUSINESS_PITCH,
  BUSINESS_SIGNUP_PATH,
  BUSINESS_TIERS,
  KISUMU_QR_REF,
  businessSignupUrl,
  kesLabel,
  tierPriceView,
} from "@/lib/business-tiers";
import { kesPerGbp, kesPerUsd } from "@/lib/pricing-display";
import { publicOrigin } from "@/lib/payments/origin";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, needsLiveRates } from "@/lib/visitor-currency";

export const metadata: Metadata = {
  title: "Kisumu shop sheet",
  robots: { index: false, follow: false },
};

export default async function KisumuBusinessSheet() {
  const origin = await publicOrigin();
  const url = businessSignupUrl(origin, KISUMU_QR_REF);
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const priceInput = { country, rates, kesPerUsd: kesPerUsd(), kesPerGbp: kesPerGbp() };

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label="Print this sheet" />
        <Link href={`${BUSINESS_SIGNUP_PATH}?ref=${KISUMU_QR_REF}`} className={btnSecondary}>
          Open the sign-up
        </Link>
      </div>
      <article className="grid gap-5 rounded-[14px] border border-line bg-card p-5 shadow-[var(--shadow-card)] print:border-0 print:shadow-none">
        <Wordmark />
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h1 className="font-serif text-3xl text-navy">Rangach Business</h1>
        <p className="text-sm leading-relaxed text-ink/80">{BUSINESS_PITCH}</p>
        <p className="text-sm text-ink/70">{BUSINESS_EXAMPLE}</p>
        <ul className="grid gap-3">
          {BUSINESS_TIERS.map((tier) => {
            const price = tierPriceView(tier, priceInput);
            return (
              <li key={tier.id} className="rounded-xl border border-line bg-paper px-3 py-3">
                <p className="font-semibold text-navy">{tier.name}</p>
                <p className="font-serif text-2xl text-navy">{price.primary}</p>
                {tier.contactUs ? <p className="text-sm font-semibold text-navy">Contact us</p> : null}
                {tier.offer ? <p className="text-sm font-semibold text-lake-dark">{tier.offer}</p> : null}
                <p className="text-sm text-ink/60">
                  Invoice {tier.kesTo ? `${kesLabel(tier.kes)}–${kesLabel(tier.kesTo).replace("KES ", "")}` : kesLabel(tier.kes)} a month
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-ink/70">{BUSINESS_ANNUAL}</p>
        <div className="grid justify-items-center gap-2">
          <StickerQr url={url} className="h-52 w-52" />
          <p className="text-center text-sm font-semibold text-navy">Scan to sign up. First month of Duka Starter is free.</p>
          <p className="break-all text-center text-xs text-ink/60">{url}</p>
        </div>
        <div className="grid gap-3">
          <h2 className="font-serif text-xl text-navy">If they ask</h2>
          {BUSINESS_OBJECTIONS.map((item) => (
            <p key={item.question} className="text-sm leading-relaxed text-ink/80">
              <span className="font-semibold text-navy">{item.question}</span> {item.answer}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
