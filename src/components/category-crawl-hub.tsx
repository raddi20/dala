import Link from "next/link";
import { Pager } from "@/components/pager";
import { appName } from "@/lib/brand";
import { categoryHref } from "@/lib/categories";
import { hubIntro, hubSampleLine } from "@/lib/crawl-copy";
import { categoryHubCounts, categoryShopPage } from "@/lib/crawl-data";
import { crawlPageHref } from "@/lib/crawl-index";

export async function CategoryCrawlHub({ category, shopPage }: { category: string; shopPage: number }) {
  const [counts, shops] = await Promise.all([categoryHubCounts(category), categoryShopPage(category, shopPage)]);
  const siteName = appName();
  const sample = hubSampleLine(counts.sampleTitles);
  const base = categoryHref(category);

  return (
    <section aria-label={category} className="grid gap-3">
      <h2 className="font-serif text-2xl text-navy">{category}</h2>
      <p className="max-w-2xl text-ink/80">
        {hubIntro({ placeName: category, siteName, shopCount: counts.shops, listingCount: counts.listings })}
      </p>
      {sample ? <p className="max-w-2xl text-sm text-ink/70">{sample}</p> : null}
      {shops.shops.length ? (
        <div className="grid gap-2">
          <h3 className="font-serif text-xl text-navy">Shops</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {shops.shops.map((shop) => (
              <li key={shop.slug}>
                <Link href={`/b/${encodeURIComponent(shop.slug)}`} className="font-semibold text-gold-d">
                  {shop.name}
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={shops.page} pageCount={shops.pageCount} hrefFor={(next) => crawlPageHref(base, "shops", next)} />
        </div>
      ) : (
        <p className="text-sm text-ink/60">No public shops in this category yet.</p>
      )}
    </section>
  );
}
