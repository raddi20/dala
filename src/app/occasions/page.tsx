import type { Metadata } from "next";
import Link from "next/link";
import { cardClass, sectionTitleClass } from "@/components/ui";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Occasions",
  description:
    "Shops and listings for homecomings, weddings and ayie, funerals, Christmas at home, and a house back home. Chat stays on WhatsApp.",
};

export default async function OccasionsPage() {
  await ensureOccasionDefinitions(prisma);
  const occasions = await prisma.occasion.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: {
        select: {
          shops: { where: { storefront: { published: true } } },
          listings: { where: { listing: { hidden: false } } },
        },
      },
    },
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 pb-24 sm:pb-10">
      <div>
        <h1 className={sectionTitleClass}>Occasions</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          The weeks when family in London or Nairobi is paying for something at home: a visit, ayie, a funeral, Christmas,
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
