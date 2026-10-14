import { ProtectedOrderForm } from "@/components/protected-order-form";
import { cardClass } from "@/components/ui";
import { AUDIENCE_LINE } from "@/lib/brand";
import { kesPerGbp, kesPerUsd } from "@/lib/pricing-display";
import { prisma } from "@/lib/prisma";
import {
  commissionPercent,
  deliveryChoices,
  kesLabelFromSubunit,
  protectedOrdersOn,
} from "@/lib/protected-order";
import { readVisitorCountry } from "@/lib/visitor-country";
import { currencyForCountry, visitorPrice, cachedUsdRates, needsLiveRates } from "@/lib/visitor-currency";

function shownPrice(
  subunit: number,
  country: string | null,
  rates: Record<string, number> | null,
) {
  const kes = subunit / 100;
  const kesLabel = kesLabelFromSubunit(subunit);
  const perGbp = kesPerGbp();
  const pounds = Math.max(1, Math.round(kes / (perGbp > 0 ? perGbp : 170)));
  const shown = visitorPrice({
    country,
    kes: { amount: Math.max(1, Math.round(kes)), label: kesLabel },
    gbp: { amount: pounds, label: `£${pounds}` },
    rates,
    kesPerUsd: kesPerUsd(),
  });
  if (shown.kind === "charges") return `${shown.kesLabel} · ${shown.gbpLabel}`;
  if (shown.kind === "exact" && currencyForCountry(country) === "KES") return kesLabel;
  return `${shown.label} · charged ${kesLabel}`;
}

export async function ProtectedOrderPanel({
  slug,
  subaccount,
  offerings,
}: {
  slug: string;
  subaccount: string | null;
  offerings: { id: string; title: string; unitSubunit: number }[];
}) {
  if (!protectedOrdersOn() || !subaccount || offerings.length === 0) return null;
  const rows = await prisma.shopDeliveryOption.findMany({ where: { storefront: { slug } } });
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const deliveries = deliveryChoices(rows).map((choice) => ({
    id: choice.id,
    label: choice.label,
    price: choice.feeKes === 0 ? "KES 0" : shownPrice(choice.feeKes * 100, country, rates),
  }));

  return (
    <section id="protected-order" className={`${cardClass} grid gap-4 p-5`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h2 className="mt-2 font-serif text-2xl text-navy">Protected order</h2>
        <p className="mt-2 text-sm text-ink/70">
          Pay the shop for fresh tilapia or another listed item. Pickup is free. A flat fee or a zone fee is added when
          the shop has set one.
        </p>
      </div>
      <ProtectedOrderForm
        slug={slug}
        percent={commissionPercent()}
        offerings={offerings.map((offering) => ({
          id: offering.id,
          title: offering.title,
          price: shownPrice(offering.unitSubunit, country, rates),
        }))}
        deliveries={deliveries}
      />
    </section>
  );
}
