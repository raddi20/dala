import type { Metadata } from "next";
import Link from "next/link";
import { PayForm } from "@/components/pay-form";
import { appName, defaultSiteUrl } from "@/lib/brand";
import { CHARGE, FEATURED_DAYS, FREE_OFFERING_CAP, PRO_DAYS, PRO_OFFERING_CAP, type PaidProduct } from "@/lib/constants";
import { kesPerGbp, kesPerUsd } from "@/lib/pricing-display";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, localFx, needsLiveRates, visitorPrice, type LocalFx } from "@/lib/visitor-currency";
import { formatPlanDate, isProActive, proLapsed } from "@/lib/pro";
import { paymentConfig } from "@/lib/payments/config";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Promote" };

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/upgrade");
  const sp = await searchParams;
  const payments = paymentConfig();
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const fx: LocalFx = localFx({ country, rates, kesPerUsd: kesPerUsd(), kesPerGbp: kesPerGbp() });
  const featuredPrice = visitorPrice({
    country,
    kes: CHARGE.featured.Nairobi,
    gbp: CHARGE.featured.London,
    rates,
    kesPerUsd: fx.kesPerUsd,
  });
  const proPrice = visitorPrice({
    country,
    kes: CHARGE.verified_pro.Nairobi,
    gbp: CHARGE.verified_pro.London,
    rates,
    kesPerUsd: fx.kesPerUsd,
  });
  const featuredLabel = featuredPrice.kind === "charges" ? `${featuredPrice.kesLabel} / ${featuredPrice.gbpLabel}` : featuredPrice.label;
  const proLabel = proPrice.kind === "charges" ? `${proPrice.kesLabel} / ${proPrice.gbpLabel}` : proPrice.label;
  const requested = one(sp.product);
  const defaultProduct: PaidProduct = requested === "verified_pro" ? "verified_pro" : "featured";
  const listings = await prisma.listing.findMany({
    where: { ownerId: user.id },
    select: { id: true, title: true, city: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Promote</h1>
        <p className="mt-2 text-sm text-ink/70">
          Featured listings stay raised for {FEATURED_DAYS} days ({featuredLabel}). That is a directory boost, separate from a shop. Verified Pro is {proLabel} per {PRO_DAYS} days: a shop banner, a shop video, and {PRO_OFFERING_CAP} offerings instead of {FREE_OFFERING_CAP}. Renewing early adds {PRO_DAYS} days to the current end date. It is shown as Pro plan and does not grant Phone, Location, or Business verified. An admin grants those shop checks. The green listing Verified badge stays an admin action too. Card numbers stay on Flutterwave.{" "}
          {featuredPrice.kind === "approx" ? "Figures marked ≈ are approximate and are not the amount checkout charges. " : ""}
          <Link href="/pricing" className="font-semibold text-lake-dark hover:text-lake">
            Public prices
          </Link>
          .
        </p>
      </div>
      <PayForm
        listings={listings}
        defaultListingId={one(sp.listing)}
        defaultProduct={defaultProduct}
        userCity={user.city}
        proActive={isProActive(user)}
        proLapsed={proLapsed(user)}
        proUntilLabel={user.verifiedProUntil ? formatPlanDate(user.verifiedProUntil) : ""}
        mode={payments.mode}
        webhookReady={payments.webhookReady}
        brandName={appName()}
        siteUrl={defaultSiteUrl()}
        localFx={fx}
      />
    </div>
  );
}
