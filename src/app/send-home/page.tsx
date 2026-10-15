import type { Metadata } from "next";
import Link from "next/link";
import { SendHomeForm } from "@/components/send-home-form";
import { cardClass, sectionTitleClass } from "@/components/ui";
import { AUDIENCE_LINE } from "@/lib/brand";
import { kesPerGbp, kesPerUsd } from "@/lib/pricing-display";
import { prisma } from "@/lib/prisma";
import {
  SEND_HOME_BASKETS,
  SEND_HOME_WAITLIST_NOTE,
  basketPriceLabel,
  isListedPilot,
} from "@/lib/send-home";
import { readVisitorCountry } from "@/lib/visitor-country";
import { cachedUsdRates, needsLiveRates } from "@/lib/visitor-currency";

export const metadata: Metadata = {
  title: "Send home",
  description:
    "Join the waitlist for a basket sent home to Kisumu and nearby towns. Kenya, East Africa and the Diaspora. No card orders yet.",
};

export default async function SendHomePage() {
  const country = await readVisitorCountry();
  const rates = needsLiveRates(country) ? await cachedUsdRates() : null;
  const priceInput = { country, rates, kesPerUsd: kesPerUsd(), kesPerGbp: kesPerGbp() };
  const baskets = SEND_HOME_BASKETS.map((basket) => ({
    id: basket.id,
    label: basketPriceLabel(basket, priceInput),
  }));
  const shops = await prisma.storefront.findMany({
    where: { sendHomePilot: true },
    select: {
      slug: true,
      published: true,
      hidden: true,
      user: { select: { name: true, city: true, suspended: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  const pilots = shops.filter((shop) =>
    isListedPilot({
      sendHomePilot: true,
      published: shop.published,
      hidden: shop.hidden,
      ownerSuspended: shop.user.suspended,
    }),
  );

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h1 className={`${sectionTitleClass} mt-2`}>Tuma nyumbani</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/80" lang="en">
          Send a basket home. A grocery basket, fresh tilapia, or catering for an ayie.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink/80" lang="sw">
          Tuma chakula nyumbani. Hatuchukui oda ya kadi bado.
        </p>
        <p className="mt-2 text-sm text-ink/70" lang="luo">
          Oor chiemo dala
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">{SEND_HOME_WAITLIST_NOTE}</p>
      </header>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl text-navy">Pilot shops</h2>
        {pilots.length === 0 ? (
          <p className="text-sm text-ink/70">No pilot shops yet. Leave your email and we will write when one is ready.</p>
        ) : (
          <ul className="grid gap-2">
            {pilots.map((shop) => (
              <li key={shop.slug} className={`${cardClass} px-4 py-3 text-sm`}>
                <Link href={`/b/${shop.slug}`} className="font-semibold text-navy">
                  {shop.user.name}
                </Link>
                <p className="text-ink/60">{shop.user.city}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${cardClass} grid gap-4 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Join the waitlist</h2>
        <SendHomeForm baskets={baskets} />
      </section>
    </div>
  );
}
