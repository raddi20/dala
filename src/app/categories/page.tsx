import type { Metadata } from "next";
import Link from "next/link";
import { cardClass, sectionTitleClass } from "@/components/ui";
import { APP_DESCRIPTION, appName } from "@/lib/brand";
import { CATEGORIES, CATEGORY_GROUPS, categoryHref } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { buildShareMetadata } from "@/lib/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await publicOrigin();
  const name = appName();
  return buildShareMetadata({
    origin,
    path: "/categories",
    title: "Categories",
    description: `All ${CATEGORIES.length} categories on ${name}. ${APP_DESCRIPTION}`,
    image: "/categories/opengraph-image",
    imageAlt: `Categories on ${name}`,
  });
}

export default async function CategoriesPage() {
  const counts = await prisma.listing.groupBy({
    by: ["category"],
    where: { hidden: false },
    _count: { _all: true },
  });
  const countFor = new Map(counts.map((row) => [row.category, row._count._all]));

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">Nairobi, Kenya and the Diaspora</p>
        <h1 className={`${sectionTitleClass} mt-2`}>Categories</h1>
        <p className="mt-3 max-w-2xl text-ink/70">
          {CATEGORIES.length} ways to browse Luo shops and classifieds. The names that were already on the home page are unchanged, and each one still opens the same browse link.
        </p>
      </div>
      {CATEGORY_GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="grid gap-3">
          <div>
            <h2 className="font-serif text-2xl text-navy">{group.title}</h2>
            <p className="mt-1 text-sm text-ink/65">{group.blurb}</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {group.categories.map((category) => {
              const count = countFor.get(category) ?? 0;
              return (
                <li key={category}>
                  <Link
                    href={categoryHref(category)}
                    className={`${cardClass} flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-navy/20`}
                  >
                    <span className="font-medium text-navy">{category}</span>
                    <span className="shrink-0 text-sm text-ink/50">
                      {count === 1 ? "1 listing" : `${count} listings`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
