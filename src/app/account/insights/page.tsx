import type { Metadata } from "next";
import Link from "next/link";
import { setTipsEmailPreference } from "@/app/account/insights/actions";
import { btnSecondary, cardClass } from "@/components/ui";
import { ruleTips, sellerStatsJson, type ListingHygiene, type WeekCounts } from "@/lib/ai/seller-tips";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your week" };
export const dynamic = "force-dynamic";

const emptyCounts = (): WeekCounts => ({ listingViews: 0, shopViews: 0, whatsappTaps: 0, callTaps: 0 });

export default async function InsightsPage() {
  const user = await requireUser("/account/insights");
  const now = new Date();
  const week = 7 * 24 * 60 * 60 * 1000;
  const current = emptyCounts();
  const previous = emptyCounts();
  let hygiene: ListingHygiene = { missingPhoto: 0, noPrice: 0, shortDescription: 0, noOfferings: 0, noOccasion: 0, listings: 0 };
  let tip: { summary: string; tips: { title: string; body: string }[] } | null = null;
  let optedIn = false;

  try {
    const [prefs, shop, listings, latest] = await Promise.all([
      prisma.sellerAiPrefs.findUnique({ where: { userId: user.id }, select: { tipsEmailOptIn: true } }),
      prisma.storefront.findUnique({
        where: { userId: user.id },
        select: { id: true, offerings: { where: { archived: false }, select: { id: true } } },
      }),
      prisma.listing.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          photoUrl: true,
          priceLabel: true,
          description: true,
          occasions: { select: { id: true } },
          ...{ ["hidden"]: true as const },
        },
      }),
      prisma.sellerTip.findFirst({ where: { userId: user.id }, orderBy: { weekStart: "desc" } }),
    ]);
    optedIn = prefs?.tipsEmailOptIn ?? false;
    const visible = listings.filter((listing) => (listing as { hidden?: boolean }).hidden !== true);
    hygiene = {
      listings: visible.length,
      missingPhoto: visible.filter((listing) => !listing.photoUrl.trim()).length,
      noPrice: visible.filter((listing) => !listing.priceLabel.trim()).length,
      shortDescription: visible.filter((listing) => listing.description.trim().length < 40).length,
      noOfferings: shop && shop.offerings.length === 0 ? 1 : 0,
      noOccasion: visible.filter((listing) => listing.occasions.length === 0).length,
    };
    const ids = new Set(visible.map((listing) => listing.id));
    const events = await prisma.statEvent.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 2 * week) } },
      select: { kind: true, listingId: true, storefrontId: true, createdAt: true },
    });
    for (const event of events) {
      const onListing = Boolean(event.listingId && ids.has(event.listingId));
      const onShop = Boolean(shop && event.storefrontId === shop.id);
      if (!onListing && !onShop) continue;
      const bucket = event.createdAt.getTime() >= now.getTime() - week ? current : previous;
      if (onListing && event.kind === "listing_view") bucket.listingViews += 1;
      if (onShop && event.kind === "shop_view") bucket.shopViews += 1;
      if (event.kind === "whatsapp_tap") bucket.whatsappTaps += 1;
      if (event.kind === "call_tap") bucket.callTaps += 1;
    }
    if (latest) {
      const parsed = JSON.parse(latest.tipsJson) as { summary?: string; tips?: { title: string; body: string }[] };
      tip = { summary: parsed.summary ?? latest.statsJson, tips: parsed.tips ?? [] };
    }
  } catch {
    tip = null;
  }

  const shown = tip ?? ruleTips(hygiene);
  const stats = JSON.parse(sellerStatsJson(current, previous, hygiene)) as {
    current: WeekCounts;
    previous: WeekCounts;
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Your week</h1>
        <p className="mt-2 text-sm text-ink/70">Counts from your own pages. This does not contact buyers.</p>
        <Link href="/account" className="mt-2 inline-block text-sm font-semibold text-lake-dark underline">
          Account
        </Link>
      </div>
      <section className={`${cardClass} grid gap-2 p-5 text-sm`}>
        <h2 className="font-serif text-2xl text-navy">Last 7 days</h2>
        <p>Listing views: {stats.current.listingViews} (previous {stats.previous.listingViews})</p>
        <p>Shop views: {stats.current.shopViews} (previous {stats.previous.shopViews})</p>
        <p>WhatsApp taps: {stats.current.whatsappTaps} (previous {stats.previous.whatsappTaps})</p>
        <p>Call taps: {stats.current.callTaps} (previous {stats.previous.callTaps})</p>
      </section>
      <section className={`${cardClass} grid gap-2 p-5 text-sm`}>
        <h2 className="font-serif text-2xl text-navy">{tip ? "This week's note" : "Checklist"}</h2>
        <p>{shown.summary}</p>
        <ul className="grid gap-2">
          {shown.tips.map((item) => (
            <li key={item.title}>
              <span className="font-semibold">{item.title}:</span> {item.body}
            </li>
          ))}
        </ul>
      </section>
      <form action={setTipsEmailPreference} className={`${cardClass} grid gap-3 p-5 text-sm`}>
        <p>Email is off unless you opt in, and only when Rangach has mail turned on.</p>
        <input type="hidden" name="optIn" value={optedIn ? "0" : "1"} />
        <button className={btnSecondary}>{optedIn ? "Stop the weekly email" : "Email me this note"}</button>
      </form>
    </div>
  );
}
