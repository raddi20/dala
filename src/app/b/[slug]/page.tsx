import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { RemoteImage } from "@/components/remote-image";
import { ReportForm } from "@/components/report-form";
import { Flash, btnPrimary, btnSecondary } from "@/components/ui";
import { regionForCity, regionLabel } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { shopReviews, shopSignals } from "@/lib/storefront";
import { averageRating, formatOfferingPrice, formatWhen, telHref } from "@/lib/utils";
import { whatsappOfferingLink, whatsappShopLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    select: { published: true, userId: true, user: { select: { name: true, bio: true } } },
  });
  if (!shop) return { title: "Shop" };
  if (!shop.published) {
    const viewer = await getSessionUser();
    if (viewer?.id !== shop.userId) return { title: "Shop" };
  }
  return { title: shop.user.name, description: shop.user.bio.slice(0, 160) };
}

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params;
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    include: {
      user: true,
      offerings: {
        where: { archived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!shop) notFound();

  const viewer = await getSessionUser();
  const isOwner = viewer?.id === shop.userId;
  if (!shop.published && !isOwner) notFound();

  if (viewer && !isOwner) {
    const blocked = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: shop.userId } },
    });
    if (blocked) notFound();
  }

  const [signals, reviews] = await Promise.all([shopSignals(shop.userId), shopReviews(shop.userId)]);
  const region = regionForCity(shop.user.city);
  const rating = averageRating(reviews);
  const url = `${await origin()}/b/${shop.slug}`;
  const phone = shop.user.whatsapp || shop.user.phone;
  const chatUrl = phone ? whatsappShopLink(phone, url) : "";
  const callUrl = telHref(shop.user.phone);
  const initial = shop.user.name.trim().charAt(0).toUpperCase() || "D";
  const bannerSrc = shop.user.verifiedPro ? shop.bannerUrl : "";

  return (
    <article className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      {!shop.published && isOwner ? (
        <Flash>This shop is a draft. Only you can see this preview.</Flash>
      ) : null}

      <header className="overflow-hidden rounded-2xl border border-sand bg-card">
        <RemoteImage src={bannerSrc} alt="" className="aspect-[2/1] w-full object-cover sm:aspect-[3/1]">
          <div className="flex aspect-[2/1] items-end bg-lake-dark p-4 text-white sm:aspect-[3/1]">
            <span className="font-serif text-4xl">{initial}</span>
            {signals.category ? (
              <span className="ml-auto max-w-[60%] text-right text-xs uppercase tracking-wide text-white/80">
                {signals.category}
              </span>
            ) : null}
          </div>
        </RemoteImage>
        <div className="px-4 pb-5">
          <RemoteImage
            src={shop.user.avatarUrl}
            alt=""
            className="-mt-8 h-16 w-16 rounded-full border-4 border-card object-cover"
          >
            <div className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-lake font-serif text-2xl text-white">
              {initial}
            </div>
          </RemoteImage>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-medium">Shop</span>
            {signals.verified ? (
              <span className="rounded-full bg-lake px-2 py-0.5 text-xs font-semibold text-white">Verified</span>
            ) : null}
            {shop.user.verifiedPro ? (
              <span className="rounded-full bg-clay px-2 py-0.5 text-xs font-semibold text-white">Verified Pro</span>
            ) : null}
          </div>
          <h1 className="mt-2 font-serif text-4xl leading-tight">{shop.user.name}</h1>
          <p className="mt-1 text-ink/70">
            {shop.user.city} · {regionLabel(region)}
            {signals.category ? ` · ${signals.category}` : ""}
            {signals.address ? ` · ${signals.address}` : ""}
          </p>
          {signals.listingId ? (
            <Link href={`/listings/${signals.listingId}`} className="mt-2 inline-block text-sm font-semibold text-lake-dark">
              Directory listing{signals.listingTitle ? `: ${signals.listingTitle}` : ""}
            </Link>
          ) : null}
        </div>
      </header>

      {shop.user.bio ? (
        <section className="rounded-2xl border border-sand bg-card p-4">
          <h2 className="font-serif text-xl">About</h2>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{shop.user.bio}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-sand bg-card p-4">
        <h2 className="font-serif text-xl">Contact</h2>
        <p className="mt-1 text-sm text-ink/70">Ask on WhatsApp. Payment for goods stays between you and the seller.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {chatUrl ? (
            <a href={chatUrl} className={btnPrimary} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
          {callUrl ? (
            <a href={callUrl} className={btnSecondary}>
              Call
            </a>
          ) : null}
          {shop.user.email ? (
            <a href={`mailto:${shop.user.email}`} className={btnSecondary}>
              Email
            </a>
          ) : null}
        </div>
        <div className="mt-3 text-sm text-ink/70">
          {shop.user.phone ? <p>Phone {shop.user.phone}</p> : null}
          {shop.user.whatsapp ? <p>WhatsApp {shop.user.whatsapp}</p> : null}
          {shop.user.email ? <p>{shop.user.email}</p> : null}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Offerings</h2>
        {shop.offerings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sand bg-card p-6 text-sm">No offerings listed yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {shop.offerings.map((offering) => {
              const price = formatOfferingPrice(offering.priceCents, offering.currency);
              const offeringChat = phone ? whatsappOfferingLink(phone, offering.title, url) : "";
              const letter = offering.title.trim().charAt(0).toUpperCase() || "D";
              return (
                <article key={offering.id} className="flex flex-col overflow-hidden rounded-2xl border border-sand bg-card">
                  <RemoteImage src={offering.imageUrl} alt={offering.title} className="aspect-[4/3] w-full object-cover">
                    <div className="flex aspect-[4/3] items-end bg-lake-dark p-3 text-white">
                      <span className="font-serif text-3xl">{letter}</span>
                    </div>
                  </RemoteImage>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-serif text-xl leading-snug">{offering.title}</h3>
                    {price ? <p className="font-semibold">{price}</p> : null}
                    {offering.description ? <p className="text-sm leading-relaxed text-ink/80">{offering.description}</p> : null}
                    {offeringChat ? (
                      <a href={offeringChat} className={`${btnPrimary} mt-auto`} target="_blank" rel="noreferrer">
                        Chat on WhatsApp
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="reviews" className="grid gap-3">
        <h2 className="font-serif text-2xl">Reviews</h2>
        <p className="text-sm text-ink/70">
          {rating === null
            ? "No reviews yet."
            : `${rating.toFixed(1)} out of 5 from ${reviews.length} review${reviews.length === 1 ? "" : "s"} on this seller's listings.`}
        </p>
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-sand bg-card p-4">
              <p className="text-sm font-semibold">
                {review.rating} / 5 · {review.author.name}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{review.body}</p>
              <p className="mt-2 text-xs text-ink/50">
                <Link href={`/listings/${review.listing.id}#reviews`} className="font-semibold text-lake-dark">
                  {review.listing.title}
                </Link>
                {" · "}
                {formatWhen(review.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm">
        <Link href={`/people/${shop.user.id}`} className="font-semibold text-lake-dark">
          View profile
        </Link>
      </p>

      {viewer && !isOwner ? (
        <details className="rounded-2xl border border-sand bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Report this shop</summary>
          <div className="mt-3">
            <ReportForm targetUserId={shop.userId} />
          </div>
        </details>
      ) : null}
      {!viewer ? (
        <Link href={`/login?next=/b/${shop.slug}`} className="text-sm font-semibold text-lake-dark">
          Sign in to report this shop
        </Link>
      ) : null}
    </article>
  );
}
