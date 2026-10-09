import type { Metadata } from "next";
import Link from "next/link";
import { cardClass, sectionTitleClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { publicListingWhere, publicShopWhere } from "@/lib/demo-visibility";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { publicOrigin } from "@/lib/payments/origin";
import { prisma } from "@/lib/prisma";
import { buildShareMetadata } from "@/lib/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const name = appName();
  return buildShareMetadata({
    origin,
    path: "/occasions",
    title: "Occasions",
    description: `Homecomings, weddings and ayie, funerals, Christmas at home, and a house back home on ${name}. Chat stays on WhatsApp.`,
    image: "/occasions/opengraph-image",
    imageAlt: `Occasions on ${name}`,
  });
}

export default async function OccasionsPage() {
  await ensureOccasionDefinitions(prisma);
  const occasions = await prisma.occasion.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: {
        select: {
          shops: { where: { storefront: publicShopWhere({ published: true }) } },
          listings: { where: { listing: publicListingWhere({ hidden: false }) } },
        },
      },
    },
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 pb-24 sm:pb-10">
      <div>
        <h1 className={sectionTitleClass}>Occasions</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          The weeks when family in Kenya, East Africa and the Diaspora is paying for something at home: a visit, ayie, a funeral, Christmas,
          or a house going up. Each page lists shops and listings tagged for that moment. You message the seller on
          WhatsApp. Nothing is booked or paid here.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {occasions.map((occasion) => {
          const count = occasion._count.shops + occasion._count.listings;
          return (
            <Link key={occasion.id} href={`/occasions/${occasion.slug}`} className={`card-lift ${cardClass} p-5`}>
              <h2 className="font-serif text-2xl text-navy">{occasion.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/70">{occasion.intro}</p>
              <p className="mt-4 text-sm font-semibold text-lake-dark">
                {count === 0 ? "Coming soon" : `${count} shop${count === 1 ? "" : "s"} and listings`}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
