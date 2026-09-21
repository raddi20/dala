import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Badges } from "@/components/badges";
import { ReportForm } from "@/components/report-form";
import { ReviewForm } from "@/components/review-form";
import { Flash } from "@/components/ui";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { blockUser } from "@/lib/actions/social";
import { setListingHidden, setListingVerified } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { averageRating, formatWhen, one, telHref } from "@/lib/utils";
import { whatsappChatLink, whatsappShareLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { title: true } });
  return { title: listing?.title ?? "Listing" };
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      owner: true,
      reviews: {
        where: { hidden: false },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!listing) notFound();

  const user = await getSessionUser();
  const isOwner = user?.id === listing.ownerId;
  const isAdmin = user?.role === "admin";
  if (listing.hidden && !isOwner && !isAdmin) notFound();

  const blocked = user
    ? await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: listing.ownerId } },
      })
    : null;
  const rating = averageRating(listing.reviews);
  const shareUrl = whatsappShareLink(listing.title, `${await origin()}/listings/${listing.id}`);
  const chatUrl = listing.contactWhatsapp ? whatsappChatLink(listing.contactWhatsapp, listing.title) : "";
  const callUrl = telHref(listing.contactPhone);
  const notice =
    one(sp.posted) === "1" ? "Listing published." : one(sp.updated) === "1" ? "Changes saved." : "";

  return (
    <article className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      {notice ? <Flash>{notice}</Flash> : null}
      {listing.hidden ? <Flash>This listing is hidden from browse. Only you and moderators can open it.</Flash> : null}

      {listing.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.photoUrl} alt={listing.title} className="aspect-video w-full rounded-2xl border border-sand bg-sand object-cover" />
      ) : (
        <div className="flex aspect-video items-end rounded-2xl bg-lake-dark p-4 text-white">
          <span className="font-serif text-4xl">{listing.title.charAt(0).toUpperCase()}</span>
          <span className="ml-auto text-sm uppercase tracking-wide text-white/80">{listing.category}</span>
        </div>
      )}

      <div className="grid gap-3">
        <Badges
          type={listing.type}
          verified={listing.verified}
          verifiedPro={listing.owner.verifiedPro}
          featured={listing.featured}
          featuredUntil={listing.featuredUntil}
          scamRisk={listing.scamRisk}
        />
        <h1 className="font-serif text-4xl leading-tight">{listing.title}</h1>
        <p className="text-ink/70">
          {listing.city} · {listing.region === "diaspora" ? "Diaspora" : "Homeland"} · {listing.category}
          {listing.address ? ` · ${listing.address}` : ""}
        </p>
        {listing.priceLabel ? <p className="text-lg font-semibold">{listing.priceLabel}</p> : null}
        <p className="text-sm text-ink/70">
          {rating === null ? "No reviews yet" : `${rating.toFixed(1)} out of 5 from ${listing.reviews.length} review${listing.reviews.length === 1 ? "" : "s"}`}
          {" · "}
          {formatWhen(listing.createdAt)}
        </p>
      </div>

      {listing.scamRisk !== "low" ? (
        <div className="rounded-2xl border border-warn/40 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-warn">Automatic check: {listing.scamRisk} risk</p>
          <p className="mt-1">{listing.scamNotes}</p>
          <p className="mt-2 text-ink/70">Do not send money before you have met or inspected what is advertised.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {chatUrl ? (
          <a href={chatUrl} className={btnPrimary} target="_blank" rel="noreferrer">
            WhatsApp the seller
          </a>
        ) : null}
        <a href={shareUrl} className={btnSecondary} target="_blank" rel="noreferrer">
          Share on WhatsApp
        </a>
        {callUrl ? (
          <a href={callUrl} className={btnSecondary}>
            Call
          </a>
        ) : null}
        {isOwner ? (
          <>
            <Link href={`/listings/${listing.id}/edit`} className={btnSecondary}>
              Edit
            </Link>
            <Link href={`/upgrade?listing=${listing.id}`} className={btnSecondary}>
              Feature this listing
            </Link>
          </>
        ) : null}
      </div>

      <div className="whitespace-pre-wrap text-base leading-relaxed">{listing.description}</div>

      <section className="rounded-2xl border border-sand bg-card p-4">
        <h2 className="font-serif text-xl">Contact</h2>
        <p className="mt-1">{listing.contactName || listing.owner.name}</p>
        {listing.contactPhone ? <p className="text-sm">{listing.contactPhone}</p> : null}
        {listing.contactWhatsapp ? <p className="text-sm">WhatsApp {listing.contactWhatsapp}</p> : null}
        <Link href={`/people/${listing.owner.id}`} className="mt-3 inline-block text-sm font-semibold text-lake-dark">
          View {listing.owner.kind === "business" ? "business" : "person"} profile
        </Link>
      </section>

      <section id="reviews" className="grid gap-4">
        <h2 className="font-serif text-2xl">Reviews</h2>
        {listing.reviews.length === 0 ? <p className="text-sm text-ink/70">No reviews yet.</p> : null}
        <ul className="grid gap-3">
          {listing.reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-sand bg-card p-4">
              <p className="text-sm font-semibold">
                {review.rating} / 5 · {review.author.name}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{review.body}</p>
              <p className="mt-2 text-xs text-ink/50">{formatWhen(review.createdAt)}</p>
            </li>
          ))}
        </ul>
        {user && !isOwner ? <ReviewForm listingId={listing.id} /> : null}
        {!user ? (
          <Link href={`/login?next=/listings/${listing.id}`} className="text-sm font-semibold text-lake-dark">
            Sign in to review
          </Link>
        ) : null}
      </section>

      {user && !isOwner ? (
        <section className="grid gap-3">
          <details className="rounded-2xl border border-sand bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Report this listing</summary>
            <div className="mt-3">
              <ReportForm listingId={listing.id} targetUserId={listing.ownerId} />
            </div>
          </details>
          {blocked ? (
            <p className="text-sm text-ink/70">You have blocked this person. Their other listings are hidden from your browse.</p>
          ) : (
            <form action={blockUser}>
              <input type="hidden" name="userId" value={listing.ownerId} />
              <input type="hidden" name="returnTo" value={`/listings/${listing.id}`} />
              <button className="text-sm font-semibold text-danger">Block this person</button>
            </form>
          )}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="grid gap-2 rounded-2xl border border-sand bg-card p-4">
          <h2 className="font-serif text-xl">Moderation</h2>
          <div className="flex flex-wrap gap-2">
            <form action={setListingHidden}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="hidden" value={listing.hidden ? "0" : "1"} />
              <button className={btnSecondary}>{listing.hidden ? "Unhide" : "Hide"}</button>
            </form>
            <form action={setListingVerified}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="verified" value={listing.verified ? "0" : "1"} />
              <button className={btnSecondary}>{listing.verified ? "Remove verified" : "Grant verified"}</button>
            </form>
          </div>
        </section>
      ) : null}
    </article>
  );
}
