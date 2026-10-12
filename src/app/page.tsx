import Link from "next/link";
import { HomeRail } from "@/components/home-rail";
import { ListingCard } from "@/components/listing-card";
import { OfferingCard } from "@/components/offering-card";
import { ShopCard } from "@/components/shop-card";
import { btnPrimary, chipClass, EmptyState } from "@/components/ui";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { AUDIENCE_LINE } from "@/lib/brand";
import { occasionTileOrder } from "@/lib/home-fresh";
import { HOME_ASK_PLACEHOLDER, HOME_CATEGORY_CHIPS, HOME_PROMPTS, homePromptHref } from "@/lib/home-prompts";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { PAID_UPGRADES_COMING_SOON, paymentsLive } from "@/lib/payments/live";
import { prisma } from "@/lib/prisma";
import { homeRails } from "@/lib/search";
import { getSessionUser } from "@/lib/session";
import { continueHref } from "@/lib/utils";

export default async function HomePage() {
  const user = await getSessionUser();
  const listHref = continueHref(Boolean(user), "/listings/new");
  const paymentsOpen = paymentsLive();
  const listingWriter = await isAiFeatureOn("listing_writer");
  await ensureOccasionDefinitions(prisma);
  const [rails, occasions] = await Promise.all([
    homeRails(user?.id),
    prisma.occasion.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { slug: true, title: true },
    }),
  ]);
  const tiles = occasionTileOrder(occasions);
  const fresh = rails.fresh;

  return (
    <div>
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 pb-4 pt-5">
          <h1 className="font-serif text-3xl text-white">Ask Rangach</h1>
          <p className="mt-1 text-sm text-white/75">Shops and classifieds in {AUDIENCE_LINE}. Chat stays on WhatsApp.</p>
          <form action="/listings" method="get" className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor="home-nl">
              Search in a sentence
            </label>
            <input
              id="home-nl"
              name="nl"
              placeholder={HOME_ASK_PLACEHOLDER}
              className="min-h-11 w-full rounded-[14px] border-0 bg-white px-3.5 text-base text-ink placeholder:text-ink/40"
            />
            <button className={`${btnPrimary} shrink-0 px-5`}>Ask</button>
          </form>
          <div className="chip-scroll -mx-4 mt-3 px-4 pb-1">
            {HOME_PROMPTS.map((prompt) => (
              <Link key={prompt.query} href={homePromptHref(prompt.query)} className={`${chipClass} bg-white`}>
                {prompt.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <div className="chip-scroll -mx-4 px-4 py-3">
          {HOME_CATEGORY_CHIPS.map((chip) => (
            <Link key={chip.label} href={chip.href} className={chipClass}>
              {chip.label}
            </Link>
          ))}
        </div>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl text-navy">Fresh</h2>
            <Link href="/listings" className="shrink-0 text-sm font-semibold text-gold-d">
              See all
            </Link>
          </div>
          {fresh.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="Nothing fresh yet"
                body="Shops and classifieds show here as people publish them."
                action={
                  <Link href={listHref} className={btnPrimary}>
                    List your business free
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {fresh.map((item, index) =>
                item.kind === "listing" ? (
                  <ListingCard key={item.id} listing={item.listing} priority={index < 2} />
                ) : (
                  <OfferingCard key={item.id} offering={item.offering} priority={index < 2} />
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 [contain-intrinsic-size:auto_720px] [content-visibility:auto]">
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl text-navy">Shops</h2>
            <Link href="/shops" className="shrink-0 text-sm font-semibold text-gold-d">
              All shops
            </Link>
          </div>
          {rails.shops.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No shops yet" body="Shops show here after a seller adds an offering and publishes." />
            </div>
          ) : (
            <div className="chip-scroll -mx-4 mt-3 items-stretch px-4 pb-1">
              {rails.shops.map((shop) => (
                <div key={shop.id} className="w-[46vw] max-w-[220px] shrink-0">
                  <ShopCard shop={shop} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl text-navy">Occasions</h2>
            <Link href="/occasions" className="shrink-0 text-sm font-semibold text-gold-d">
              All occasions
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">Homecomings, weddings and ayie, Christmas at home, and a house being built for the family.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tiles.map((occasion) => (
              <Link key={occasion.slug} href={`/occasions/${occasion.slug}`} className={chipClass}>
                {occasion.title}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] bg-navy px-4 py-5 text-white">
          <h2 className="font-serif text-2xl text-white">Buying for family back home?</h2>
          <p className="mt-2 max-w-xl text-sm text-white/80">
            Some shops take a WhatsApp order from the Diaspora for family in Kenya. Payment stays between you and the seller.
          </p>
          <Link href="/listings?diaspora=1" className={`${btnPrimary} mt-4`}>
            See those shops
          </Link>
        </section>

        <section className="rounded-[20px] border border-line bg-card px-4 py-5">
          <h2 className="font-serif text-2xl text-navy">List your business free</h2>
          <p className="mt-2 max-w-xl text-sm text-ink/70">
            Open a shop, add what you sell, and buyers message you on WhatsApp. {AUDIENCE_LINE}.
          </p>
          {listingWriter ? <p className="mt-2 text-sm text-ink/70">Rangach can draft the listing words for you.</p> : null}
          <p className="mt-2 text-sm text-muted">
            {paymentsOpen ? "Featured and Pro prices are on the pricing page." : `${PAID_UPGRADES_COMING_SOON}. Listing a business is free.`}
          </p>
          <Link href={listHref} className={`${btnPrimary} mt-4`}>
            List your business free
          </Link>
        </section>

        {paymentsOpen ? (
          <HomeRail
            title="Featured"
            hint="Raised listings worth a look first."
            browseHref="/listings"
            browseLabel="Browse all"
            empty={rails.featured.length === 0}
            emptyTitle="No featured listings yet"
            emptyBody="Featured listings show here after a seller pays for a place at the top. Listing a business is free."
            action={
              <Link href={listHref} className={btnPrimary}>
                List your business free
              </Link>
            }
          >
            {rails.featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </HomeRail>
        ) : null}
      </div>
    </div>
  );
}
